import type { DayRow } from './daily';

/** A pattern is shown only when each group has at least this many days. */
export const MIN_DAYS = 7;
/** ...and the share of days with a hard moment differs by at least this much. */
export const MIN_DIFFERENCE = 0.25;

export type FactorKey = 'short_night' | 'missed_dose' | 'constipated' | 'night_wakings';

export interface Pattern {
  key: string;
  factor: FactorKey;
  /** 0: same day; 1: the factor is followed by the next day. */
  lag: 0 | 1;
  withDays: string[];
  withHits: string[];
  withoutDays: string[];
  withoutHits: string[];
  /** Both groups have at least 10 days. */
  steady: boolean;
}

export interface Learning {
  factor: FactorKey;
  have: number;
  need: number;
}

const SHORT_NIGHT_MIN = 7 * 60;

/** Factor value for a day; null when it wasn't noted (those days don't count either way). */
function factorOf(r: DayRow, f: FactorKey): boolean | null {
  switch (f) {
    case 'short_night':
      return r.sleepMin === null ? null : r.sleepMin < SHORT_NIGHT_MIN;
    case 'night_wakings':
      return r.wakings === null ? null : r.wakings >= 2;
    case 'missed_dose':
      return r.dosesGiven + r.dosesLate + r.dosesMissed === 0 ? null : r.dosesMissed + r.dosesLate > 0;
    case 'constipated':
      return r.constipated;
  }
}

/**
 * With-vs-without comparisons on the daily table: is a hard moment more common on days with the factor
 * (or the day after it) than on days without? Returns counts and the raw days, never causes.
 */
export function findPatterns(rows: DayRow[]): { patterns: Pattern[]; learning: Learning[] } {
  const patterns: Pattern[] = [];
  const learning: Learning[] = [];
  const factors: { f: FactorKey; lag: 0 | 1 }[] = [
    { f: 'short_night', lag: 0 },
    { f: 'night_wakings', lag: 0 },
    { f: 'missed_dose', lag: 1 },
    { f: 'constipated', lag: 0 },
  ];
  for (const { f, lag } of factors) {
    const withDays: string[] = [];
    const withHits: string[] = [];
    const withoutDays: string[] = [];
    const withoutHits: string[] = [];
    for (let i = 0; i + lag < rows.length; i++) {
      const factor = factorOf(rows[i]!, f);
      const outcomeRow = rows[i + lag]!;
      if (factor === null || !outcomeRow.logged) continue;
      const hit = outcomeRow.hard > 0;
      if (factor) {
        withDays.push(outcomeRow.day);
        if (hit) withHits.push(outcomeRow.day);
      } else {
        withoutDays.push(outcomeRow.day);
        if (hit) withoutHits.push(outcomeRow.day);
      }
    }
    const have = Math.min(withDays.length, withoutDays.length);
    if (have < MIN_DAYS) {
      if (withDays.length + withoutDays.length > 0) learning.push({ factor: f, have, need: MIN_DAYS });
      continue;
    }
    const rate = (h: string[], d: string[]) => h.length / d.length;
    if (rate(withHits, withDays) - rate(withoutHits, withoutDays) >= MIN_DIFFERENCE && withHits.length >= 3) {
      patterns.push({
        key: `${f}:${lag}`,
        factor: f,
        lag,
        withDays,
        withHits,
        withoutDays,
        withoutHits,
        steady: withDays.length >= 10 && withoutDays.length >= 10,
      });
    }
  }
  return { patterns, learning };
}

export const TIME_BUCKETS: [number, number][] = [
  [6, 9],
  [9, 12],
  [12, 15],
  [15, 18],
  [18, 21],
];

/** Hard moments by time of day; shown once there are at least 7 to count. */
export function timeOfDay(rows: DayRow[]): { counts: number[]; total: number; peak: number } | null {
  const minutes = rows.flatMap((r) => r.hardMinutes);
  if (minutes.length < MIN_DAYS) return null;
  const counts = TIME_BUCKETS.map(([a, b]) => minutes.filter((m) => m >= a * 60 && m < b * 60).length);
  const peak = counts.indexOf(Math.max(...counts));
  return { counts, total: minutes.length, peak };
}
