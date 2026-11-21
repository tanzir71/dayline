import { describe, expect, it } from 'vitest';
import { getDict } from '../../i18n';
import fixtures from './fixtures.json';
import { parse, type Draft, type VoiceCtx } from './parse';

interface Expected {
  kind?: string;
  medicine_id?: string | null;
  start?: string;
  end?: string;
  size?: number;
  place?: string;
  data?: Record<string, unknown>;
  tags?: { type: string; tag: string }[];
  question?: Record<string, unknown>;
  confidence?: string;
}

interface Case {
  id: string;
  must: boolean;
  lang: 'en' | 'bn';
  now?: string;
  text: string;
  expect: Expected[];
}

const file = fixtures as unknown as { context: Omit<VoiceCtx, 'now' | 'lang' | 'labels'> & { now: string }; cases: Case[] };

/** The fixture's wall clock as this machine's local time, so results don't depend on the host zone. */
function wallClock(iso: string): Date {
  const [y, mo, d, h, mi, s] = iso.match(/\d+/g)!.map(Number) as [number, number, number, number, number, number];
  return new Date(y, mo - 1, d, h, mi, s);
}

const wall = (iso: string | null | undefined) => iso?.slice(0, 16) ?? null;

function compare(want: Expected, got: Draft, at: string): string[] {
  const out: string[] = [];
  const check = (field: string, expected: unknown, actual: unknown) => {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) out.push(`${at}.${field}: wanted ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };
  if (want.kind !== undefined) check('kind', want.kind, got.kind);
  if (want.medicine_id !== undefined) check('medicine_id', want.medicine_id, got.medicine_id);
  if (want.start !== undefined) check('start', want.start, wall(got.started_at));
  if (want.end !== undefined) check('end', want.end, wall(got.ended_at));
  if (want.size !== undefined) check('size', want.size, got.size);
  if (want.place !== undefined) check('place', want.place, got.place);
  if (want.confidence !== undefined) check('confidence', want.confidence, got.confidence);
  if (want.tags !== undefined) check('tags', want.tags, got.tags);
  for (const [k, v] of Object.entries(want.data ?? {})) check(`data.${k}`, v, got.data[k]);
  for (const [k, v] of Object.entries(want.question ?? {})) check(`question.${k}`, v, (got.question as Record<string, unknown> | undefined)?.[k]);
  return out;
}

function problems(c: Case): string[] {
  const ctx: VoiceCtx = { ...file.context, now: wallClock(c.now ?? file.context.now), lang: c.lang, labels: getDict(c.lang).app.log };
  const drafts = parse(c.text, ctx);
  if (drafts.length !== c.expect.length) return [`wanted ${c.expect.length} drafts, got ${drafts.length}: ${JSON.stringify(drafts.map((d) => d.kind))}`];
  return c.expect.flatMap((want, i) => compare(want, drafts[i]!, `[${i}]`));
}

const results = file.cases.map((c) => ({ c, problems: problems(c) }));

describe('voice parser fixtures', () => {
  it.each(results.filter((r) => r.c.must).map((r) => [r.c.id, r.problems] as const))('must: %s', (_id, found) => {
    expect(found).toEqual([]);
  });

  it('passes at least 85% of all cases', () => {
    const failing = results.filter((r) => r.problems.length).map((r) => `${r.c.id}: ${r.problems.join('; ')}`);
    const rate = (results.length - failing.length) / results.length;
    if (failing.length) console.info(`Failing optional cases:\n${failing.join('\n')}`);
    expect(rate, failing.join('\n')).toBeGreaterThanOrEqual(0.85);
  });
});
