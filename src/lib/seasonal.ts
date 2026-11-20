import calendar from '../../content/calendar.json';
import type { Lang } from './paths';

export interface SeasonalEvent {
  key: string;
  name: Record<Lang, string>;
  start: string;
  end: string;
  approx: boolean;
  guides: string[];
}

export const events = calendar.events as SeasonalEvent[];

/** Days before an event when its guides start to show as "this week" picks. */
export const LEAD_DAYS = 30;

const day = 86_400_000;
const toDate = (iso: string) => new Date(`${iso}T00:00:00`);

/** Events whose window [start - LEAD_DAYS, end] contains `today`, nearest first. */
export function upcoming(today: Date, list: SeasonalEvent[] = events): (SeasonalEvent & { inDays: number })[] {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return list
    .map((e) => ({ ...e, inDays: Math.round((toDate(e.start).getTime() - t) / day), endsIn: Math.round((toDate(e.end).getTime() - t) / day) }))
    .filter((e) => e.inDays <= LEAD_DAYS && e.endsIn >= 0)
    .sort((a, b) => a.inDays - b.inDays);
}
