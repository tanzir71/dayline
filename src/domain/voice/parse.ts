import type { EventKind } from '../../data/types';
import type { Dict } from '../../i18n';
import { hhmmToMinutes, isoWithOffset, localDay } from '../../lib/time';
import { SYMPTOMS } from '../labels';
import { doseStatusAt } from '../schedule';
import { bn } from './lexicon.bn';
import { en, type Ate, type Gut, type Lexicon, type Meal, type Quality } from './lexicon.en';
import { matchMedicine, matchPlaybook, transliterate } from './match';
import { compile, nfc, normalize, words } from './normalize';
import { atLocal, readTime, resolveSleep, resolveStart, saidTime, type Clock, type TimeInfo } from './time';

type AppDict = Dict['app'];

export interface VoiceCtx {
  now: Date;
  /** App language: decides the labels that get stored. */
  lang: 'en' | 'bn';
  child: { name: string; hard_moment_word: string | null };
  /** Active medicines and their schedule times. */
  medicines: { id: string; generic_name: string; brand_name: string; strength_text: string; times: string[] }[];
  /** Settings 'voice.aliases': heard word → medicine_id. */
  aliases: Record<string, string>;
  /** PlaybookItem.text where situation = hard_moment. */
  playbookHelped: string[];
  loggedToday: { medicine_id: string; schedule_time: string | null }[];
  labels: AppDict['log'];
}

export interface Draft {
  kind: EventKind;
  /** Local ISO with offset (isoWithOffset). */
  started_at: string;
  ended_at: string | null;
  /** hard_moment 1–5. */
  size: number | null;
  /** A label from labels.places. */
  place: string | null;
  /** The shapes Quick log writes. A dose also carries status and schedule_time for markDose. */
  data: Record<string, unknown>;
  tags: { type: 'before' | 'helped'; tag: string }[];
  /** The clause as said, saved as DayEvent.note. */
  heard: string;
  medicine_id?: string | null;
  question?: { type: 'new_medicine' | 'which_medicine'; heard_name?: string; options?: string[] };
  /** 'check' = a default was assumed (time or medicine). */
  confidence: 'sure' | 'check';
}

type Medicine = VoiceCtx['medicines'][number];

const both = (pick: (l: Lexicon) => string[], flags?: string) => compile([...pick(en), ...pick(bn)], flags);
const indexed = (pick: (l: Lexicon) => string[][]) => pick(en).map((terms, i) => compile([...terms, ...(pick(bn)[i] ?? [])]));
function keyed<K extends string>(pick: (l: Lexicon) => Record<K, string[]>): [K, RegExp][] {
  return (Object.keys(pick(en)) as K[]).map((k) => [k, compile([...pick(en)[k], ...pick(bn)[k]])]);
}
const firstKey = <K>(list: [K, RegExp][], text: string): K | undefined => list.find(([, re]) => re.test(text))?.[0];

const NOTE = both((l) => l.note);
const GENERIC = both((l) => l.doseGeneric);
const GIVE = both((l) => l.doseGive);
const MISSED = both((l) => l.doseMissed);
const REFUSED = both((l) => l.doseRefused);
const NOT_DONE = both((l) => l.doseNotDone);
const CONFIRMED = both((l) => l.doseConfirm);
const BARE_WORDS = new Set([...en.doseBare, ...bn.doseBare].map((w) => nfc(w)));
const SLEEP = both((l) => l.sleep.filter((w) => !l.sleepWeak.includes(w)));
const SLEEP_WEAK = both((l) => l.sleepWeak);
const WAKE = both((l) => l.wake);
const NAP = both((l) => l.nap);
const HARD = both((l) => l.hard);
const FOOD = both((l) => [...l.food, ...l.gutTrigger]);
const SCHOOL = both((l) => l.school);
const WIN = both((l) => l.win);
const HELPED_CUE = both((l) => l.helpedCue);
const HELPED_ANY = both((l) => l.helped.flat(), 'giu');
const SIZE_NOT = both((l) => l.sizeNot, 'giu');
const HURT_SELF = both((l) => l.hurtSelf, 'giu');

const QUALITIES = keyed<Quality>((l) => l.quality);
const MEALS = keyed<Meal>((l) => l.meal);
const ATES = keyed<Ate>((l) => l.ate);
const GUTS = keyed<Gut>((l) => l.gut);
const SIZES: [number, RegExp][] = ([5, 4, 3, 1] as const).map((n) => [n, compile([...en.size[n], ...bn.size[n]])]);
const PLACES = indexed((l) => l.place);
const BEFORES = indexed((l) => l.before);
const HELPED = indexed((l) => l.helped);

/** Gut symptoms are stored on food: labels.symptomDays counts those flags for the same keys. */
const GUT_SYMPTOMS = new Set(['constipation', 'diarrhoea']);
const SYMPTOM_TERMS: { term: string; key: string | null; re: RegExp }[] = [
  ...SYMPTOMS.filter((s) => !GUT_SYMPTOMS.has(s.key)).flatMap((s) =>
    [s.en, s.bn, ...s.label, ...(s.en.match(/\(([^)]+)\)/)?.slice(1) ?? [])].map((term) => ({ term: term.replace(/\s*\([^)]*\)/, ''), key: s.key as string | null })),
  ),
  ...[...en.health, ...bn.health].flatMap((h) => h.terms.map((term) => ({ term, key: h.key }))),
]
  .sort((a, b) => b.term.length - a.term.length)
  .map((x) => ({ ...x, re: compile([x.term]) }));
const HEALTH = compile(SYMPTOM_TERMS.map((s) => s.term));
/** "ঘুম ঘুম ভাব" and "upset stomach" are symptoms, so their words must not read as sleep or a hard moment. */
const SYMPTOM_PHRASE = compile(
  SYMPTOM_TERMS.filter((s) => s.term.includes(' ')).map((s) => s.term),
  'giu',
);

function termsOf(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(termsOf);
  if (v && typeof v === 'object') return Object.values(v).flatMap(termsOf);
  return [];
}
const EVERYDAY = compile([...new Set([...termsOf(en), ...termsOf(bn)].flatMap((t) => t.split(/\s+/)))]);
const isEveryday = (word: string) => EVERYDAY.test(word);

const FILLERS = new Set([...en.filler, ...bn.filler].map(nfc));
const JOINERS = new Set([...en.joiners, ...bn.joiners].map(nfc));
const AND_WORDS = new Set([...en.andWords, ...bn.andWords].map(nfc));
const UNKNOWN_VERBS_EN = new Set(en.doseUnknownVerbs);
const UNKNOWN_VERBS_BN = new Set(bn.doseUnknownVerbs.map(nfc));
const SKIP_BEFORE_NAME = new Set(['him', 'her', 'his', 'the', 'a', 'an']);

interface Hit {
  kind: EventKind;
  medicine?: Medicine;
  unknown?: string;
  generic?: boolean;
}

interface Clause {
  start: number;
  end: number;
  raw: string;
  norm: string;
  /** Follows an "and", so it can share the other side's verb and time. */
  afterAnd: boolean;
}

interface Slots {
  time?: TimeInfo;
  durationMin?: number;
  medicineId?: string;
  unknown?: string;
  generic?: boolean;
  status?: 'missed' | 'refused';
  gave?: boolean;
  size?: number;
  place?: string;
  before?: string[];
  helped?: string[];
  bed?: Clock;
  wake?: Clock;
  sleepWhen?: TimeInfo;
  nap?: boolean;
  quality?: Quality;
  wakings?: number;
  meal?: Meal;
  ate?: Ate;
  gut?: Gut;
  symptom?: string;
  symptomKey?: string | null;
  value?: string;
  phrase?: string;
}

interface Working {
  kind: EventKind;
  slots: Slots;
  start: number;
  end: number;
  afterAnd: boolean;
}

/** In English the word after the verb, in Bangla the word before it. */
function unknownMedicine(tokens: string[], ctx: VoiceCtx): string | undefined {
  const name = nfc(ctx.child.name).toLowerCase().split(/\s+/)[0] ?? '';
  const isName = (w: string) => w === name || w === `${name}'s`;
  const usable = (w: string | undefined): w is string => {
    if (!w || /\d/.test(w) || isName(w) || isEveryday(w)) return false;
    return (/[ঀ-৿]/.test(w) ? transliterate(w) : w).replace(/[^a-z]/g, '').length >= 4;
  };
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? '';
    let candidate: string | undefined;
    if (UNKNOWN_VERBS_EN.has(token)) {
      let j = i + 1;
      while (j < tokens.length && (SKIP_BEFORE_NAME.has(tokens[j] ?? '') || isName(tokens[j] ?? ''))) j++;
      candidate = tokens[j];
    } else if (UNKNOWN_VERBS_BN.has(token)) {
      candidate = tokens[i - 1];
    }
    if (usable(candidate)) return candidate;
  }
  return undefined;
}

/** A medicine said with only a time around it ("Keppra at 1") counts as a dose. */
function isBareMention(tokens: string[], medicine: Medicine, ctx: VoiceCtx): boolean {
  const child = nfc(ctx.child.name).toLowerCase();
  return tokens.every((w) => /^\d/.test(w) || BARE_WORDS.has(w) || w === child || matchMedicine([w], [medicine], ctx.aliases, isEveryday) !== null);
}

function classify(norm: string, ctx: VoiceCtx, hardWord: RegExp | null): Hit | null {
  if (NOTE.test(norm)) return { kind: 'note' };
  const tokens = words(norm);
  const medicine = matchMedicine(tokens, ctx.medicines, ctx.aliases, isEveryday) as Medicine | null;
  // A wrong "given" could make someone skip a real dose, so a dose needs clear words. Otherwise keep a note.
  const saidNotGiven = MISSED.test(norm) || REFUSED.test(norm);
  if (!saidNotGiven && (medicine || GENERIC.test(norm) || GIVE.test(norm)) && NOT_DONE.test(norm)) return { kind: 'note' };
  if (medicine) return saidNotGiven || GIVE.test(norm) || CONFIRMED.test(norm) || isBareMention(tokens, medicine, ctx) ? { kind: 'dose', medicine } : { kind: 'note' };
  if (GENERIC.test(norm) && (MISSED.test(norm) || REFUSED.test(norm) || GIVE.test(norm))) return { kind: 'dose', generic: true };
  const unknown = unknownMedicine(tokens, ctx);
  if (unknown) return { kind: 'dose', unknown };
  const rest = norm.replace(SYMPTOM_PHRASE, ' ');
  if (SLEEP.test(rest) || (SLEEP_WEAK.test(rest) && !HEALTH.test(norm))) return { kind: 'sleep' };
  if (HARD.test(rest) || hardWord?.test(norm)) return { kind: 'hard_moment' };
  if (HEALTH.test(norm)) return { kind: 'health' };
  if (FOOD.test(norm)) return { kind: 'food' };
  if (SCHOOL.test(norm)) return { kind: 'school' };
  if (WIN.test(norm)) return { kind: 'win' };
  return null;
}

/** Split on punctuation, then on joiners when both sides have a kind of their own. */
function splitClauses(text: string, hasKind: (norm: string) => boolean): Clause[] {
  const out: Clause[] = [];
  const push = (start: number, end: number, afterAnd: boolean) => {
    const raw = text.slice(start, end);
    const norm = normalize(raw);
    if (words(norm).some((w) => !FILLERS.has(w))) out.push({ start, end, raw, norm, afterAnd });
  };
  const segment = (from: number, to: number) => {
    const tokens = [...text.slice(from, to).matchAll(/\S+/gu)].map((m) => ({
      word: nfc(m[0]).toLowerCase(),
      start: from + m.index,
      end: from + m.index + m[0].length,
    }));
    let first = 0;
    let afterAnd = false;
    for (let i = 0; i < tokens.length; ) {
      if (!JOINERS.has(tokens[i]?.word ?? '')) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < tokens.length && JOINERS.has(tokens[j]?.word ?? '')) j++;
      const isAnd = j === i + 1 && AND_WORDS.has(tokens[i]?.word ?? '');
      if (i === first) {
        first = j;
        afterAnd = isAnd;
      } else if (j < tokens.length) {
        const leftStart = tokens[first]?.start ?? from;
        const leftEnd = tokens[i - 1]?.end ?? from;
        const rightStart = tokens[j]?.start ?? to;
        const rightEnd = tokens[tokens.length - 1]?.end ?? to;
        if (hasKind(normalize(text.slice(leftStart, leftEnd))) && hasKind(normalize(text.slice(rightStart, rightEnd)))) {
          push(leftStart, leftEnd, afterAnd);
          first = j;
          afterAnd = isAnd;
        }
      }
      i = j;
    }
    const start = tokens[first]?.start;
    const end = tokens[tokens.length - 1]?.end;
    if (start !== undefined && end !== undefined) push(start, end, afterAnd);
  };

  let from = 0;
  for (const m of text.matchAll(/[?!;,\n।.]/gu)) {
    const i = m.index;
    const ch = m[0];
    if ((ch === '.' || ch === ',') && /\p{Nd}/u.test(text[i - 1] ?? '') && /\p{Nd}/u.test(text[i + 1] ?? '')) continue;
    if (ch === '.' && /(?:^|[\s\d])(?:[ap]\.?m|[ap]|dr)$/i.test(text.slice(Math.max(0, i - 5), i))) continue;
    segment(from, i);
    from = i + 1;
  }
  segment(from, text.length);
  return out;
}

function temperature(norm: string): string | undefined {
  for (const m of norm.matchAll(/(?<![\d.:])(\d{2,3}(?:\.\d+)?)(?![\d:])/g)) {
    const n = Number(m[1]);
    if (n >= 34 && n <= 43) return `${m[1]} °C`;
    if (n >= 90 && n <= 110) return `${m[1]} °F`;
  }
  return undefined;
}

function fillSleep(s: Slots, norm: string, t: TimeInfo): void {
  const waking = WAKE.test(norm);
  const [one, two] = t.clocks;
  if (one && two) {
    s.bed = one;
    s.wake = two;
  } else if (one) {
    if (waking) s.wake = one;
    else s.bed = one;
  }
  if (NAP.test(norm)) s.nap = true;
  s.quality = firstKey(QUALITIES, norm);
  const count = waking ? /(\d+)\s*(?:times?\b|বার)/u.exec(norm) : null;
  if (count) s.wakings = Number(count[1]);
  // Bedtime and wake time name different parts of day, so this one never counts as a clash.
  if (saidTime(t)) s.sleepWhen = { ...t, clocks: [] };
}

function fillHard(s: Slots, norm: string, ctx: VoiceCtx): void {
  const said = /\bsize\s*([1-5])\b/.exec(norm);
  const sizeText = norm.replace(SIZE_NOT, ' ');
  s.size = said ? Number(said[1]) : firstKey(SIZES, sizeText);

  let at = Infinity;
  PLACES.forEach((re, i) => {
    const m = re.exec(norm);
    const label = ctx.labels.places[i];
    if (m && label && m.index < at) {
      at = m.index;
      s.place = label;
    }
  });

  let beforeText = norm.replace(HURT_SELF, ' ');
  if (HELPED_CUE.test(norm)) {
    const own = matchPlaybook(norm, ctx.playbookHelped);
    s.helped = own.length ? own : HELPED.flatMap((re, i) => (re.test(norm) ? [ctx.labels.helpedFallback[i] ?? ''] : [])).filter(Boolean);
    beforeText = beforeText.replace(HELPED_ANY, ' ');
  }
  s.before = BEFORES.flatMap((re, i) => (re.test(beforeText) ? [ctx.labels.befores[i] ?? ''] : [])).filter(Boolean);
}

function fillHealth(s: Slots, clause: Clause, ctx: VoiceCtx): void {
  const found = SYMPTOM_TERMS.find((x) => x.re.test(clause.norm));
  if (found) {
    const known = SYMPTOMS.find((x) => x.key === found.key);
    s.symptom = known ? known[ctx.lang] : found.term;
    s.symptomKey = found.key;
    const raw = nfc(clause.raw);
    const m = found.re.exec(raw);
    const after = m ? raw.slice(m.index + m[0].length).trim() : '';
    if (after) s.phrase = after;
  }
  s.value = temperature(clause.norm);
}

function fill(kind: EventKind, clause: Clause, hit: Hit | null, ctx: VoiceCtx): Slots {
  const { norm } = clause;
  const t = readTime(norm);
  const s: Slots = {};
  if (t.durationMin !== null) s.durationMin = t.durationMin;
  if (kind === 'sleep') {
    fillSleep(s, norm, t);
    return s;
  }
  if (saidTime(t)) s.time = t;
  s.meal = firstKey(MEALS, norm);
  if (kind === 'dose') {
    if (hit?.medicine) s.medicineId = hit.medicine.id;
    if (hit?.unknown) s.unknown = hit.unknown;
    if (hit?.generic) s.generic = true;
    s.status = REFUSED.test(norm) ? 'refused' : MISSED.test(norm) ? 'missed' : undefined;
    if (GIVE.test(norm)) s.gave = true;
  } else if (kind === 'hard_moment') {
    fillHard(s, norm, ctx);
  } else if (kind === 'food') {
    s.ate = firstKey(ATES, norm);
    s.gut = firstKey(GUTS, norm);
  } else if (kind === 'health') {
    fillHealth(s, clause, ctx);
  }
  return s;
}

const clockKey = (c: Clock | undefined) => (c ? `${c.h}:${c.m}:${c.part}:${c.meridiem}` : '');
const timeKey = (t: TimeInfo) => JSON.stringify([t.agoMin, t.clocks.map(clockKey), t.part, t.yesterday]);
const SINGLE: (keyof Slots)[] = ['medicineId', 'unknown', 'status', 'place', 'quality', 'wakings', 'meal', 'ate', 'gut', 'symptom', 'value', 'durationMin'];

/** Would merging set one slot twice with different values? */
function clash(a: Slots, b: Slots): boolean {
  if (SINGLE.some((k) => a[k] != null && b[k] != null && a[k] !== b[k])) return true;
  if ((a.medicineId && b.unknown) || (a.unknown && b.medicineId)) return true;
  if (a.time && b.time && timeKey(a.time) !== timeKey(b.time)) return true;
  if (a.bed && b.bed && clockKey(a.bed) !== clockKey(b.bed)) return true;
  return !!(a.wake && b.wake && clockKey(a.wake) !== clockKey(b.wake));
}

function combine(a: Slots, b: Slots): Slots {
  const said = Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined)) as Slots;
  const out: Slots = { ...a, ...said };
  if (a.size !== undefined && b.size !== undefined) out.size = Math.max(a.size, b.size);
  out.before = [...new Set([...(a.before ?? []), ...(b.before ?? [])])];
  out.helped = [...new Set([...(a.helped ?? []), ...(b.helped ?? [])])];
  if (out.medicineId) out.generic = false;
  if (a.phrase) out.phrase = a.phrase;
  return out;
}

/**
 * The schedule slot: the closest planned time within ±3 h that isn't logged yet.
 * A missed dose only looks back: marking tonight's dose missed at 17:40 would take it off the plan.
 */
function slotFor(m: Medicine, at: Date, ctx: VoiceCtx, pastOnly: boolean): string | null {
  const today = localDay(at) === localDay(ctx.now);
  const atMin = at.getHours() * 60 + at.getMinutes();
  let best: string | null = null;
  let gap = 181;
  for (const time of m.times) {
    if (today && ctx.loggedToday.some((l) => l.medicine_id === m.id && l.schedule_time === time)) continue;
    if (pastOnly && atLocal(at, 0, hhmmToMinutes(time)) > ctx.now) continue;
    const g = Math.abs(hhmmToMinutes(time) - atMin);
    if (g < gap) {
      gap = g;
      best = time;
    }
  }
  return best;
}

function buildDose(s: Slots, base: Draft, ctx: VoiceCtx): Draft {
  let at = resolveStart(s.time, s.meal, ctx.now);
  const pastOnly = s.status === 'missed';
  let medicine = s.medicineId ? ctx.medicines.find((m) => m.id === s.medicineId) : undefined;
  let slot = medicine ? slotFor(medicine, at, ctx, pastOnly) : null;
  let confidence: Draft['confidence'] = 'sure';
  let question: Draft['question'];

  if (!medicine && s.unknown) {
    question = { type: 'new_medicine', heard_name: s.unknown };
  } else if (!medicine) {
    confidence = 'check';
    const near = ctx.medicines.filter((m) => slotFor(m, at, ctx, pastOnly) !== null);
    if (near.length === 1 && near[0]) {
      medicine = near[0];
      slot = slotFor(medicine, at, ctx, pastOnly);
    } else {
      question = { type: 'which_medicine', options: (near.length ? near : ctx.medicines).map((m) => m.generic_name) };
    }
  }

  if (s.status === 'missed' && !s.time && !s.meal) {
    confidence = 'check';
    if (slot) at = atLocal(at, 0, hhmmToMinutes(slot));
  }

  const started_at = isoWithOffset(at);
  return {
    ...base,
    started_at,
    medicine_id: medicine?.id ?? null,
    data: { status: s.status ?? doseStatusAt(slot, started_at), schedule_time: slot },
    confidence,
    ...(question ? { question } : {}),
  };
}

function buildSleep(s: Slots, base: Draft, ctx: VoiceCtx): Draft {
  const { start, end, assumed } = resolveSleep(
    {
      bed: s.bed,
      wake: s.wake,
      nap: !!s.nap,
      durationMin: s.durationMin,
      yesterday: s.sleepWhen?.yesterday ?? false,
      fallback: resolveStart(s.sleepWhen, undefined, ctx.now),
    },
    ctx.now,
  );
  return {
    ...base,
    started_at: isoWithOffset(start),
    ended_at: end ? isoWithOffset(end) : null,
    data: { quality: s.quality ?? null, night_wakings: s.wakings ?? 0 },
    confidence: assumed ? 'check' : 'sure',
  };
}

const durationBucket = (min: number) => (min < 5 ? 0 : min < 15 ? 1 : min < 30 ? 2 : 3);
const mealAt = (h: number): Meal => (h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack');

function buildHard(s: Slots, base: Draft, ctx: VoiceCtx): Draft {
  let start = resolveStart(s.time, s.meal, ctx.now);
  let end: Date | null = null;
  if (s.durationMin !== undefined) {
    const ms = s.durationMin * 60_000;
    if (s.time || s.meal) end = new Date(start.getTime() + ms);
    else {
      end = ctx.now;
      start = new Date(ctx.now.getTime() - ms);
    }
  }
  return {
    ...base,
    started_at: isoWithOffset(start),
    ended_at: end ? isoWithOffset(end) : null,
    size: s.size ?? null,
    place: s.place ?? null,
    data: { parent_word: ctx.child.hard_moment_word, duration_bucket: s.durationMin === undefined ? null : durationBucket(s.durationMin) },
    tags: [...(s.before ?? []).map((tag) => ({ type: 'before' as const, tag })), ...(s.helped ?? []).map((tag) => ({ type: 'helped' as const, tag }))],
  };
}

function build(w: Working, text: string, ctx: VoiceCtx): Draft {
  const s = w.slots;
  const heard = text.slice(w.start, w.end).trim();
  const at = resolveStart(s.time, s.meal, ctx.now);
  const base: Draft = { kind: w.kind, started_at: isoWithOffset(at), ended_at: null, size: null, place: null, data: {}, tags: [], heard, confidence: 'sure' };
  switch (w.kind) {
    case 'dose':
      return buildDose(s, base, ctx);
    case 'sleep':
      return buildSleep(s, base, ctx);
    case 'hard_moment':
      return buildHard(s, base, ctx);
    case 'food':
      return { ...base, data: { meal: s.meal ?? mealAt(at.getHours()), ate: s.ate ?? null, gut: s.gut ?? null } };
    case 'win':
      return { ...base, data: { text: heard } };
    case 'school':
      return { ...base, data: { summary: heard } };
    case 'health':
      return { ...base, data: { symptom: s.symptom ?? '', symptom_key: s.symptomKey ?? null, value: s.value ?? s.phrase ?? '' } };
    default:
      return base;
  }
}

/** "Missed risperidone and Keppra at 8": a dose with no verb or time of its own shares its neighbour's. */
function shareAcrossDoses(list: Working[]): void {
  list.forEach((b, i) => {
    const a = list[i - 1];
    if (!a || a.kind !== 'dose' || b.kind !== 'dose') return;
    if (a.slots.status && !b.slots.status && !b.slots.gave) b.slots.status = a.slots.status;
    if (b.afterAnd && !a.slots.time && b.slots.time) a.slots.time = b.slots.time;
  });
}

/** Turn what was said into day-line drafts. Pure: no DOM, no database. */
export function parse(text: string, ctx: VoiceCtx): Draft[] {
  if (words(normalize(text)).filter((w) => !FILLERS.has(w)).length < 2) return [];
  const own = ctx.child.hard_moment_word?.trim();
  const hardWord = own ? compile([own]) : null;
  const kindOf = (norm: string) => classify(norm, ctx, hardWord);
  const clauses = splitClauses(text, (norm) => kindOf(norm) !== null);
  const list: Working[] = [];

  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i];
    if (!clause) continue;
    const hit = kindOf(clause.norm);
    const last = list[list.length - 1];

    if (!hit) {
      // "This morning, he hit his sister": a lead-in that is only a time belongs to what follows.
      const next = clauses[i + 1];
      const leadIn = words(clause.norm).length <= 3 && saidTime(readTime(clause.norm));
      if (next && leadIn && (!last || last.slots.time) && kindOf(next.norm)) {
        clauses[i + 1] = { ...next, start: clause.start, raw: text.slice(clause.start, next.end), norm: `${clause.norm} ${next.norm}` };
        continue;
      }
      if (!last) {
        list.push({ kind: 'note', slots: fill('note', clause, null, ctx), start: clause.start, end: clause.end, afterAnd: false });
        continue;
      }
      const slots = fill(last.kind, clause, null, ctx);
      if (!clash(last.slots, slots)) last.slots = combine(last.slots, slots);
      last.end = clause.end;
      continue;
    }

    const slots = fill(hit.kind, clause, hit, ctx);
    if (last && last.kind === hit.kind && !clash(last.slots, slots)) {
      last.slots = combine(last.slots, slots);
      last.end = clause.end;
      continue;
    }
    list.push({ kind: hit.kind, slots, start: clause.start, end: clause.end, afterAnd: clause.afterAnd });
  }

  shareAcrossDoses(list);
  return list.map((w) => build(w, text, ctx));
}
