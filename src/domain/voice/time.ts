import { en, type Meal, type Part } from './lexicon.en';
import { bn } from './lexicon.bn';
import { WORD_END, compile, nfc, rx } from './normalize';

/**
 * Times are built from the Date's local fields, so the result is the phone's wall clock
 * in whatever zone it is in; isoWithOffset then records that zone.
 */

export interface Clock {
  h: number;
  m: number;
  part: Part | null;
  meridiem: 'am' | 'pm' | null;
}

export interface TimeInfo {
  clocks: Clock[];
  part: Part | null;
  agoMin: number | null;
  durationMin: number | null;
  yesterday: boolean;
}

const PARTS: Part[] = ['morning', 'noon', 'afternoon', 'evening', 'night'];
const PART_MIN: Record<Part, number> = { morning: 480, noon: 780, afternoon: 960, evening: 1140, night: 1260 };
const MEAL_MIN: Record<Exclude<Meal, 'snack'>, number> = { breakfast: 480, lunch: 780, dinner: 1200 };

const PART_RE = PARTS.map((p) => [p, compile([...en.parts[p], ...bn.parts[p]])] as const);
const PART_BEFORE = PART_RE.map(([p, re]) => [p, new RegExp(`${re.source}(?:\\s+(?:at|around|by|about))?\\s*$`, 'iu')] as const);
const PART_AFTER = PART_RE.map(([p, re]) => [p, new RegExp(`^\\s*(?:in the\\s+|at\\s+|in\\s+)?${re.source}`, 'iu')] as const);
const YESTERDAY = compile([...en.yesterday, ...bn.yesterday]);
/** "রাতের খাবার" is a meal and "bad night" a verdict: neither states a part of day. */
const NOT_A_PART = compile(['সকালের খাবার', 'দুপুরের খাবার', 'রাতের খাবার', 'good night', 'bad night'], 'giu');

const AMOUNT = '(\\d+(?::\\d{2}|\\.\\d+)?)';
const UNIT = '(?:(mins?|minutes?|মিনিট[\\p{L}\\p{M}]*)|(hrs?|hours?|ঘণ্টা[\\p{L}\\p{M}]*))';
const AGO_RE = rx(`${AMOUNT}\\s*${UNIT}${WORD_END}\\s*(?:ago|আগে)${WORD_END}`);
const DURATION_RE = rx(`${AMOUNT}\\s*${UNIT}${WORD_END}`);
const CLOCK_RE = rx("(?<![\\d.:])(\\d{1,2})(?::(\\d{2}))?(?!\\d|[.:]\\d)\\s*(?:(am|pm|o'?clock)\\b|(টায়|টার|টা))?");
const COUNTED = rx('^\\s*(?:times?\\b|tablets?\\b|pills?\\b|drops?\\b|spoons?\\b|bites?\\b|ml\\b|mg\\b|%|°|বার|ট্যাবলেট|ওষুধ|ডোজ|সিরাপ|ড্রপ|চামচ|বড়ি)', 'iu');
const CUE_BEFORE = /(?:^|\s)(?:at|around|by|from|till|until|@)\s*(?:about\s+|around\s+)?$/iu;
const RANGE_NEXT = rx('^\\s*(?:to\\s+\\d|থেকে|পর্যন্ত|বাজে)', 'iu');
const RANGE_PREV = rx('(?:^|\\s)(?:to|till|until|থেকে)\\s*$', 'iu');

const BARE_TA = nfc('টা');

const blank = (m: string) => ' '.repeat(m.length);

function toMinutes(amount: string, isHour: boolean): number {
  const [h, m] = amount.split(':');
  if (m !== undefined) return Number(h) * 60 + Number(m);
  return Math.round(Number(amount) * (isHour ? 60 : 1));
}

function firstPart(text: string): Part | null {
  let best: Part | null = null;
  let at = Infinity;
  for (const [p, re] of PART_RE) {
    const m = re.exec(text);
    if (m && m.index < at) {
      best = p;
      at = m.index;
    }
  }
  return best;
}

const partIn = (list: typeof PART_BEFORE, text: string): Part | null => list.find(([, re]) => re.test(text))?.[0] ?? null;

function findClocks(text: string, clausePart: Part | null): Clock[] {
  const out: Clock[] = [];
  for (const m of text.matchAll(CLOCK_RE)) {
    const h = Number(m[1]);
    const min = m[2] === undefined ? 0 : Number(m[2]);
    if (h > 23 || min > 59) continue;
    const before = text.slice(0, m.index);
    const after = text.slice(m.index + m[0].length);
    const suffix = m[4];
    const word = m[3];
    // 8:30, 8 pm and ৮টায় are clock times whatever follows; a bare number may be a count.
    const firm = m[2] !== undefined || word !== undefined || (suffix !== undefined && suffix !== BARE_TA);
    if (/size\s*$/i.test(before) || (!firm && COUNTED.test(after))) continue;
    const partBefore = partIn(PART_BEFORE, before);
    const partAfter = partIn(PART_AFTER, after);
    const inRange = RANGE_NEXT.test(after) || (out.length > 0 && RANGE_PREV.test(before));
    const nearby = partBefore !== null || partAfter !== null || inRange;
    // "Nটা" alone is usually a count ("একটা"), so it needs a part of day or a range around it.
    if (!firm && !nearby && (suffix === BARE_TA || !CUE_BEFORE.test(before))) continue;
    const meridiem = word === 'am' || word === 'pm' ? word : null;
    out.push({ h, m: min, part: partBefore ?? partAfter, meridiem });
  }
  const only = out[0];
  if (out.length === 1 && only && !only.part) only.part = clausePart;
  return out;
}

/** Everything the clause says about time, on normalized text. */
export function readTime(norm: string): TimeInfo {
  let agoMin: number | null = null;
  for (const m of norm.matchAll(AGO_RE)) agoMin ??= toMinutes(m[1] ?? '0', m[3] !== undefined);
  let text = norm.replace(AGO_RE, blank);
  let durationMin: number | null = null;
  for (const m of text.matchAll(DURATION_RE)) durationMin = (durationMin ?? 0) + toMinutes(m[1] ?? '0', m[3] !== undefined);
  text = text.replace(DURATION_RE, blank);
  const yesterday = YESTERDAY.test(text);
  text = text.replace(NOT_A_PART, blank);
  const part = firstPart(text);
  return { clocks: findClocks(text, part), part, agoMin, durationMin, yesterday };
}

export const saidTime = (t: TimeInfo): boolean => t.agoMin !== null || t.clocks.length > 0 || t.part !== null || t.yesterday;

export const atLocal = (base: Date, dayOffset: number, minutes: number): Date =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, Math.floor(minutes / 60), minutes % 60);

/** The 24-hour readings of a spoken hour. */
function hoursFor(c: Clock): number[] {
  const pm = (c.h % 12) + 12;
  if (c.meridiem === 'am') return [c.h % 12];
  if (c.meridiem === 'pm') return [pm];
  if (c.h > 12 || c.h === 0) return [c.h];
  switch (c.part) {
    case 'morning':
      return [c.h % 12];
    case 'noon':
      return [c.h === 11 ? 11 : pm];
    case 'afternoon':
    case 'evening':
      return [pm];
    case 'night':
      // রাত ২টা is 2 am, not 2 pm; রাত ১২টা is midnight.
      return [c.h === 12 ? 0 : c.h <= 4 ? c.h : pm];
    default:
      return [c.h % 12, pm];
  }
}

/** The latest of these wall-clock readings at or before `limit` (strictly before when `strict`). */
function latest(hours: number[], minute: number, limit: Date, strict = false): Date {
  for (let back = 0; back <= 2; back++) {
    const hits = hours.map((h) => atLocal(limit, -back, h * 60 + minute)).filter((d) => (strict ? d < limit : d <= limit));
    if (hits.length) return new Date(Math.max(...hits.map((d) => d.getTime())));
  }
  return limit;
}

const endOfYesterday = (now: Date) => atLocal(now, -1, 23 * 60 + 59);

function defaultAt(minutes: number, now: Date, yesterday: boolean): Date {
  if (yesterday) return atLocal(now, -1, minutes);
  const at = atLocal(now, 0, minutes);
  return at > now ? now : at;
}

/** Start time for every kind except sleep: ago, clock, part of day, meal, then now. */
export function resolveStart(t: TimeInfo | undefined, meal: Meal | undefined, now: Date): Date {
  if (t?.agoMin != null) return new Date(now.getTime() - t.agoMin * 60_000);
  const yesterday = t?.yesterday ?? false;
  const clock = t?.clocks[0];
  if (clock) return latest(hoursFor(clock), clock.m, yesterday ? endOfYesterday(now) : now);
  if (t?.part) return defaultAt(PART_MIN[t.part], now, yesterday);
  if (meal && meal !== 'snack') return defaultAt(MEAL_MIN[meal], now, yesterday);
  return yesterday ? atLocal(now, -1, now.getHours() * 60 + now.getMinutes()) : now;
}

export interface SleepTimes {
  bed?: Clock;
  wake?: Clock;
  nap: boolean;
  durationMin?: number;
  yesterday: boolean;
  /** Where a nap with no clock time lands. */
  fallback: Date;
}

export function resolveSleep(s: SleepTimes, now: Date): { start: Date; end: Date | null; assumed: boolean } {
  const limit = s.yesterday ? endOfYesterday(now) : now;
  const ms = (s.durationMin ?? 0) * 60_000;

  // A nap has no default bedtime: 21:00 to 06:30 would invent a night.
  if (s.nap && !s.wake) {
    if (s.bed) {
      const start = latest(hoursFor(s.bed), s.bed.m, limit);
      return { start, end: ms ? new Date(start.getTime() + ms) : null, assumed: !ms };
    }
    if (ms) return { start: new Date(limit.getTime() - ms), end: limit, assumed: true };
    return { start: s.fallback, end: null, assumed: true };
  }

  let assumed = false;
  let end: Date;
  if (s.wake) {
    // Overnight sleep: a bare 4 to 11 is the morning, even when the pm reading has already passed.
    const bare = !s.wake.meridiem && !s.wake.part && s.wake.h >= 4 && s.wake.h <= 11;
    end = latest(!s.nap && bare ? [s.wake.h] : hoursFor(s.wake), s.wake.m, limit);
  } else {
    end = latest([6], 30, limit);
    assumed = true;
  }

  let start: Date;
  if (s.bed) start = latest(hoursFor(s.bed), s.bed.m, end, true);
  else if (ms) start = new Date(end.getTime() - ms);
  else {
    start = latest([21], 0, end, true);
    assumed = true;
  }
  return { start, end, assumed };
}
