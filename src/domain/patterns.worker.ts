/// <reference lib="webworker" />
import { buildDailyTable } from './daily';
import { findPatterns, timeOfDay } from './patterns';
import type { DayEvent, EventTag } from '../data/types';

// Patterns run off the main thread so Today stays smooth on older phones.
self.onmessage = (e: MessageEvent<{ events: DayEvent[]; tags: EventTag[]; from: string; to: string }>) => {
  const rows = buildDailyTable(e.data.events, e.data.tags, e.data.from, e.data.to);
  const { patterns, learning } = findPatterns(rows);
  (self as unknown as Worker).postMessage({ patterns, learning, time: timeOfDay(rows), logged: rows.filter((r) => r.logged).length });
};
