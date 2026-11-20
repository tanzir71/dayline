import type { Change, DayEvent, DoseData, EventTag } from '../data/types';
import { addDays, dayOf, daysBetween, minutesOf } from '../lib/time';

/** One row per day: the derived table that change reviews and patterns read. Never stored. */
export interface DayRow {
  day: string;
  /** Anything at all was noted that day. */
  logged: boolean;
  hard: number;
  wins: number;
  /** Sleep that ended this morning, in minutes (null when not noted). */
  sleepMin: number | null;
  wakings: number | null;
  /** Food noted with a gut flag; null when nothing was noted about the gut. */
  constipated: boolean | null;
  noBowel: boolean | null;
  dosesGiven: number;
  dosesLate: number;
  dosesMissed: number;
  before: string[];
  helped: string[];
  hardMinutes: number[];
}

export function emptyRow(day: string): DayRow {
  return { day, logged: false, hard: 0, wins: 0, sleepMin: null, wakings: null, constipated: null, noBowel: null, dosesGiven: 0, dosesLate: 0, dosesMissed: 0, before: [], helped: [], hardMinutes: [] };
}

export function buildDailyTable(events: DayEvent[], tags: EventTag[], fromDay: string, toDay: string): DayRow[] {
  const n = daysBetween(fromDay, toDay);
  const rows = new Map<string, DayRow>();
  for (let i = 0; i <= n; i++) {
    const d = addDays(fromDay, i);
    rows.set(d, emptyRow(d));
  }
  const tagsBy = new Map<string, EventTag[]>();
  for (const t of tags) tagsBy.set(t.event_id, [...(tagsBy.get(t.event_id) ?? []), t]);
  for (const e of events) {
    if (e.deleted_at) continue;
    // Sleep belongs to the morning it ended.
    const day = e.kind === 'sleep' && e.ended_at ? dayOf(e.ended_at) : dayOf(e.started_at);
    const r = rows.get(day);
    if (!r) continue;
    r.logged = true;
    const d = e.data as Record<string, unknown>;
    switch (e.kind) {
      case 'hard_moment':
        r.hard++;
        r.hardMinutes.push(minutesOf(e.started_at));
        for (const t of tagsBy.get(e.id) ?? []) (t.type === 'before' ? r.before : r.helped).push(t.tag);
        break;
      case 'win':
        r.wins++;
        break;
      case 'sleep':
        if (e.ended_at) r.sleepMin = Math.round((new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 60000);
        r.wakings = Number(d.night_wakings ?? 0);
        break;
      case 'food':
        if (d.gut) {
          r.constipated = (r.constipated ?? false) || d.gut === 'constipated' || d.gut === 'none';
          r.noBowel = (r.noBowel ?? false) || d.gut === 'none';
        }
        break;
      case 'dose': {
        const s = (d as unknown as DoseData).status;
        if (s === 'given') r.dosesGiven++;
        else if (s === 'late') r.dosesLate++;
        else r.dosesMissed++;
        break;
      }
      default:
        break;
    }
  }
  return [...rows.values()];
}

export interface WindowStats {
  days: number;
  /** Days with anything noted. */
  covered: number;
  hardDays: number;
  hardTotal: number;
  sleepDays: number;
  sleepAvgMin: number | null;
  wakingsAvg: number | null;
  doseDays: number;
  onTime: number;
  late: number;
  missed: number;
  winDays: number;
}

export function windowStats(rows: DayRow[]): WindowStats {
  const covered = rows.filter((r) => r.logged);
  const sleeps = covered.filter((r) => r.sleepMin !== null);
  const wakes = covered.filter((r) => r.wakings !== null);
  const doses = covered.filter((r) => r.dosesGiven + r.dosesLate + r.dosesMissed > 0);
  return {
    days: rows.length,
    covered: covered.length,
    hardDays: covered.filter((r) => r.hard > 0).length,
    hardTotal: covered.reduce((s, r) => s + r.hard, 0),
    sleepDays: sleeps.length,
    sleepAvgMin: sleeps.length ? Math.round(sleeps.reduce((s, r) => s + r.sleepMin!, 0) / sleeps.length) : null,
    wakingsAvg: wakes.length ? Math.round((wakes.reduce((s, r) => s + r.wakings!, 0) / wakes.length) * 10) / 10 : null,
    doseDays: doses.length,
    onTime: covered.reduce((s, r) => s + r.dosesGiven, 0),
    late: covered.reduce((s, r) => s + r.dosesLate, 0),
    missed: covered.reduce((s, r) => s + r.dosesMissed, 0),
    winDays: covered.filter((r) => r.wins > 0).length,
  };
}

export const REVIEW_WINDOW = 14;
export const SETTLE_DAYS = 3;

export interface ChangeReview {
  before: WindowStats;
  after: WindowStats;
  /** Days after the change (after the settling days) that have passed so far. */
  afterSoFar: number;
  ready: boolean;
  overlaps: Change[];
  beforeRange: [string, string];
  afterRange: [string, string];
}

/**
 * Compare the 14 days before a change with 14 days after it, leaving out the first 3 days after.
 * Other changes inside either window are flagged, because part of any difference could be theirs.
 */
export function reviewChange(change: Change, rows: DayRow[], allChanges: Change[], today: string): ChangeReview {
  const eff = change.effective_on;
  const beforeRange: [string, string] = [addDays(eff, -REVIEW_WINDOW), addDays(eff, -1)];
  const afterRange: [string, string] = [addDays(eff, SETTLE_DAYS), addDays(eff, SETTLE_DAYS + REVIEW_WINDOW - 1)];
  const inRange = (r: DayRow, [a, b]: [string, string]) => r.day >= a && r.day <= b && r.day <= today;
  const before = windowStats(rows.filter((r) => inRange(r, beforeRange)));
  const afterRows = rows.filter((r) => inRange(r, afterRange));
  const after = windowStats(afterRows);
  const afterSoFar = Math.max(0, Math.min(REVIEW_WINDOW, daysBetween(afterRange[0], today) + 1));
  const overlaps = allChanges.filter(
    (c) => c.id !== change.id && !c.deleted_at && c.effective_on >= beforeRange[0] && c.effective_on <= afterRange[1],
  );
  return { before, after, afterSoFar, ready: afterSoFar >= REVIEW_WINDOW, overlaps, beforeRange, afterRange };
}
