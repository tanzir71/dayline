import { describe, it, expect } from 'vitest';
import { buildDailyTable, reviewChange, windowStats, emptyRow, type DayRow } from './daily';
import { findPatterns, timeOfDay, MIN_DAYS } from './patterns';
import type { Change, DayEvent } from '../data/types';
import { addDays } from '../lib/time';

const row = { created_at: '', updated_at: '', deleted_at: null };
let n = 0;
const ev = (kind: DayEvent['kind'], started: string, extra: Partial<DayEvent> = {}): DayEvent => ({
  ...row, id: `e${n++}`, child_id: 'c', kind, started_at: started, ended_at: null, size: null, place: null, data: {}, note: '', noted_by: null, source: 'tap', ...extra,
});
const sleep = (night: string, hours: number) => {
  const h = 21 + hours;
  const end = h >= 24 ? `${addDays(night, 1)}T${String(h - 24).padStart(2, '0')}:00:00+06:00` : `${night}T${h}:00:00+06:00`;
  return ev('sleep', `${night}T21:00:00+06:00`, { ended_at: end });
};
const change = (id: string, on: string): Change => ({
  ...row, id, child_id: 'c', type: 'dose_change', medicine_id: null, summary: id, reason: '', decided_by: '', effective_on: on, review_on: addDays(on, 14), outcome: 'undecided',
});

describe('daily table', () => {
  it('puts sleep on the morning it ended and counts hard moments and wins', () => {
    const rows = buildDailyTable([sleep('2026-11-01', 6), ev('hard_moment', '2026-11-02T16:00:00+06:00'), ev('win', '2026-11-02T10:00:00+06:00')], [], '2026-11-01', '2026-11-03');
    const d2 = rows.find((r) => r.day === '2026-11-02')!;
    expect(d2.sleepMin).toBe(360);
    expect(d2.hard).toBe(1);
    expect(d2.wins).toBe(1);
    expect(rows.find((r) => r.day === '2026-11-03')!.logged).toBe(false);
  });
});

describe('change review', () => {
  const days = (from: string, count: number, hardEvery: number) =>
    Array.from({ length: count }, (_, i) => {
      const d = addDays(from, i);
      return [ev('win', `${d}T09:00:00+06:00`), ...(i % hardEvery === 0 ? [ev('hard_moment', `${d}T16:00:00+06:00`)] : [])];
    }).flat();
  const events = [...days('2026-10-23', 14, 2), ...days('2026-11-06', 17, 4)];
  const rows = buildDailyTable(events, [], '2026-10-01', '2026-11-30');
  const c = change('melatonin', '2026-11-06');

  it('compares 14 days before with 14 days after, skipping the first 3 days', () => {
    const r = reviewChange(c, rows, [c], '2026-11-30');
    expect(r.beforeRange).toEqual(['2026-10-23', '2026-11-05']);
    expect(r.afterRange).toEqual(['2026-11-09', '2026-11-22']);
    expect(r.before.covered).toBe(14);
    expect(r.before.hardDays).toBe(7);
    expect(r.after.covered).toBe(14);
    expect(r.after.hardDays).toBeLessThan(r.before.hardDays);
    expect(r.ready).toBe(true);
  });

  it('flags an overlapping change and says how many days have passed', () => {
    const school = change('school', '2026-11-10');
    const r = reviewChange(c, rows, [c, school], '2026-11-12');
    expect(r.overlaps.map((x) => x.id)).toEqual(['school']);
    expect(r.afterSoFar).toBe(4);
    expect(r.ready).toBe(false);
  });

  it('counts coverage honestly when little is logged', () => {
    const s = windowStats([emptyRow('2026-11-01'), { ...emptyRow('2026-11-02'), logged: true, hard: 1 }]);
    expect(s.days).toBe(2);
    expect(s.covered).toBe(1);
    expect(s.hardDays).toBe(1);
  });
});

describe('patterns', () => {
  const mk = (day: string, sleepMin: number | null, hard: number): DayRow => ({ ...emptyRow(day), logged: true, sleepMin, hard, hardMinutes: Array(hard).fill(16 * 60) });

  it('finds "after short nights, more hard moments" with counts and raw days', () => {
    const rows: DayRow[] = [];
    for (let i = 0; i < 8; i++) rows.push(mk(addDays('2026-10-01', i), 6 * 60, i < 6 ? 1 : 0));
    for (let i = 0; i < 14; i++) rows.push(mk(addDays('2026-10-09', i), 8 * 60, i < 3 ? 1 : 0));
    const { patterns } = findPatterns(rows);
    const p = patterns.find((x) => x.factor === 'short_night')!;
    expect(p.withHits.length).toBe(6);
    expect(p.withDays.length).toBe(8);
    expect(p.withoutHits.length).toBe(3);
    expect(p.withoutDays.length).toBe(14);
    expect(p.withDays).toContain('2026-10-01');
  });

  it(`shows nothing with fewer than ${MIN_DAYS} days in either group, and says it is still learning`, () => {
    const rows: DayRow[] = [];
    for (let i = 0; i < 6; i++) rows.push(mk(addDays('2026-10-01', i), 6 * 60, 1));
    for (let i = 0; i < 20; i++) rows.push(mk(addDays('2026-10-07', i), 8 * 60, 0));
    const { patterns, learning } = findPatterns(rows);
    expect(patterns).toEqual([]);
    expect(learning.find((l) => l.factor === 'short_night')).toEqual({ factor: 'short_night', have: 6, need: MIN_DAYS });
  });

  it('ignores small differences', () => {
    const rows: DayRow[] = [];
    for (let i = 0; i < 10; i++) rows.push(mk(addDays('2026-10-01', i), 6 * 60, i < 4 ? 1 : 0));
    for (let i = 0; i < 10; i++) rows.push(mk(addDays('2026-10-11', i), 8 * 60, i < 3 ? 1 : 0));
    expect(findPatterns(rows).patterns).toEqual([]);
  });

  it('counts hard moments by time of day once there are 7', () => {
    const rows = [mk('2026-10-01', null, 5), mk('2026-10-02', null, 2)];
    rows[1]!.hardMinutes = [7 * 60, 10 * 60];
    const t = timeOfDay(rows)!;
    expect(t.total).toBe(7);
    expect(t.counts).toEqual([1, 1, 0, 5, 0]);
    expect(t.peak).toBe(3);
    expect(timeOfDay([mk('2026-10-01', null, 3)])).toBeNull();
  });
});
