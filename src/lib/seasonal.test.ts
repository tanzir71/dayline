import { describe, it, expect } from 'vitest';
import { upcoming, type SeasonalEvent } from './seasonal';

const ev = (key: string, start: string, end: string): SeasonalEvent => ({
  key, name: { en: key, bn: key }, start, end, approx: false, guides: [],
});

describe('seasonal picks', () => {
  const list = [ev('eid', '2027-03-10', '2027-03-13'), ev('victory', '2026-12-16', '2026-12-16'), ev('past', '2026-10-01', '2026-10-02')];
  it('shows events within 30 days, nearest first', () => {
    const r = upcoming(new Date('2026-11-20T10:00:00'), list);
    expect(r.map((e) => e.key)).toEqual(['victory']);
    expect(r[0]!.inDays).toBe(26);
  });
  it('keeps an event while it is happening', () => {
    const r = upcoming(new Date('2027-03-12T08:00:00'), list);
    expect(r.map((e) => e.key)).toEqual(['eid']);
    expect(r[0]!.inDays).toBeLessThan(0);
  });
  it('ignores past events', () => {
    expect(upcoming(new Date('2026-10-05T08:00:00'), list)).toEqual([]);
  });
});
