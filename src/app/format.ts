import { fmt, formatNumber } from '../i18n';
import type { AppCtx } from './context';
import type { Child, DayEvent, DoseData, EventTag, Medicine } from '../data/types';
import { minutesOf } from '../lib/time';

const locale = (lang: string) => (lang === 'bn' ? 'bn-BD' : 'en-GB');

export function timeLabel(iso: string | Date, lang: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat(locale(lang), { hour: 'numeric', minute: '2-digit', hour12: true }).format(d);
}

/** Wall-clock time as written in the stored string (the day line shows where it happened). */
export function wallTime(iso: string, lang: string): string {
  const m = minutesOf(iso);
  return hhmmLabel(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, lang);
}

export function hhmmLabel(hhmm: string, lang: string): string {
  const d = new Date(`2000-01-01T${hhmm}:00`);
  return timeLabel(d, lang);
}

export function dateLabel(d: Date, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}

export function shortDate(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function duration(mins: number, ctx: Pick<AppCtx, 't' | 'lang'>): string {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return fmt(ctx.t.common.minutes, { n: m }, ctx.lang);
  return fmt(ctx.t.common.hoursMinutes, { h, m }, ctx.lang);
}

export function hardWord(child: Child | null, ctx: Pick<AppCtx, 't'>): string {
  return child?.hard_moment_word?.trim() || ctx.t.kinds.hard_moment;
}

export function minutesBetween(a: string, b: string | null): number {
  if (!b) return 0;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

/** One line title and detail for an event on the day line. */
export function describeEvent(
  e: DayEvent,
  tags: EventTag[],
  medicines: Medicine[],
  ctx: Pick<AppCtx, 't' | 'lang' | 'child'>,
): { title: string; detail: string } {
  const t = ctx.t;
  const ev = t.events;
  const lang = ctx.lang;
  const d = e.data as Record<string, unknown>;
  const by = e.noted_by ? fmt(t.common.by, { name: e.noted_by }) : '';
  const parts: string[] = [];
  let title: string;
  switch (e.kind) {
    case 'hard_moment': {
      const mins = minutesBetween(e.started_at, e.ended_at);
      title = mins ? fmt(ev.hardMoment, { word: hardWord(ctx.child, ctx), n: mins }, lang) : fmt(ev.hardMomentShort, { word: hardWord(ctx.child, ctx) });
      const before = tags.filter((x) => x.type === 'before').map((x) => x.tag);
      const helped = tags.filter((x) => x.type === 'helped').map((x) => x.tag);
      if (before.length) parts.push(fmt(ev.before, { list: before.join(', ') }));
      if (helped.length) parts.push(fmt(ev.helped, { list: helped.join(', ') }));
      if (e.place) parts.push(fmt(ev.at, { place: e.place }));
      break;
    }
    case 'win':
      title = d.text ? fmt(ev.win, { text: String(d.text) }) : ev.winPlain;
      break;
    case 'dose': {
      const dd = d as unknown as DoseData;
      const name = medicines.find((m) => m.id === dd.medicine_id)?.generic_name ?? '';
      const key = dd.status === 'late' ? 'doseLate' : dd.status === 'missed' ? 'doseMissed' : dd.status === 'refused' ? 'doseRefused' : 'doseGiven';
      title = fmt(ev[key], { medicine: name });
      if (dd.amount_text) parts.push(dd.amount_text);
      break;
    }
    case 'sleep': {
      const mins = minutesBetween(e.started_at, e.ended_at);
      title = mins ? fmt(ev.sleep, { duration: duration(mins, ctx) }) : ev.sleepPlain;
      const w = Number(d.night_wakings ?? 0);
      if (w === 1) parts.push(ev.wakingsOne);
      else if (w > 1) parts.push(fmt(ev.wakings, { n: formatNumber(w, lang) }));
      if (d.quality && d.quality !== 'good') parts.push(t.log.qualities[d.quality as 'restless' | 'poor']);
      break;
    }
    case 'food': {
      const meal = t.log.meals[(d.meal as keyof typeof t.log.meals) ?? 'snack'] ?? '';
      const amount = d.ate ? t.log.ates[d.ate as keyof typeof t.log.ates] : '';
      title = amount ? fmt(ev.food, { meal, amount }) : fmt(ev.foodPlain, { meal });
      if (d.gut && d.gut !== 'normal') parts.push(t.log.guts[d.gut as keyof typeof t.log.guts]);
      break;
    }
    case 'school':
      title = d.summary ? fmt(ev.school, { summary: String(d.summary) }) : ev.schoolPlain;
      break;
    case 'health':
      title = [d.symptom, d.value].filter(Boolean).join(' · ') || t.kinds.health;
      break;
    default:
      title = e.note || ev.note;
  }
  if (e.note && e.kind !== 'note') parts.push(e.note);
  if (by) parts.push(by);
  if (e.source === 'help_now') parts.push(ev.fromHelpNow);
  return { title, detail: parts.join(' · ') };
}

export const KIND_TONE: Record<string, string> = {
  hard_moment: 'hard-moment',
  win: 'win',
  dose: 'medicine',
  sleep: 'sleep',
  food: 'food',
  school: 'neutral',
  health: 'hard-moment',
  note: 'neutral',
};

export function ageLabel(birthMonth: string | null, ctx: Pick<AppCtx, 't' | 'lang'>, now = new Date()): string {
  if (!birthMonth) return '';
  const [y, m] = birthMonth.split('-').map(Number);
  if (!y || !m) return '';
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (months < 0) return '';
  if (months < 24) return fmt(ctx.t.common.months, { n: months }, ctx.lang);
  const years = Math.floor(months / 12);
  return years === 1 ? ctx.t.common.yearsOne : fmt(ctx.t.common.years, { n: years }, ctx.lang);
}
