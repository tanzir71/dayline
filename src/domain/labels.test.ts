import { describe, it, expect } from 'vitest';
import { entryFor, labelFor, labelMatches, type LabelSummary } from './labels';
import type { DayEvent, Medicine } from '../data/types';

const row = { created_at: '', updated_at: '', deleted_at: null };
const med = (generic_name: string): Medicine => ({ ...row, id: generic_name, child_id: 'c', generic_name, brand_name: '', form: 'tablet', strength_text: '', prescriber_id: null, label_key: null, active: true, notes: '' });
const label = (generic: string, terms: string[]): LabelSummary => ({ generic, terms, source: 'FDA', effective_time: '20260101', fetched_at: '2026-11-20', dailymed_url: '', indications: '', boxed: false });
const ev = (kind: DayEvent['kind'], day: string, data: Record<string, unknown>): DayEvent => ({
  ...row, id: `${kind}${day}${JSON.stringify(data)}`, child_id: 'c', kind, started_at: `${day}T09:00:00+06:00`, ended_at: null, size: null, place: null, data, note: '', noted_by: null, source: 'tap',
});

describe('label check', () => {
  it('finds the curated entry from what the parent typed', () => {
    expect(entryFor('Risperidone')?.generic).toBe('risperidone');
    expect(entryFor('methylphenidate')?.generic).toBe('methylphenidate hydrochloride');
    expect(entryFor('Clonidine HCl 0.1 mg')?.generic).toBe('clonidine hydrochloride');
    expect(entryFor('')).toBeUndefined();
  });

  it('matches noted symptoms to labels of current medicines, as questions', () => {
    const labels = [label('risperidone', ['sleepiness', 'constipation', 'appetite_up'])];
    const events = [
      ev('health', '2026-11-01', { symptom_key: 'sleepiness' }),
      ev('health', '2026-11-02', { symptom_key: 'sleepiness' }),
      ev('food', '2026-11-03', { gut: 'none' }),
      ev('health', '2026-11-04', { symptom_key: 'rash' }),
    ];
    const m = labelMatches(events, [med('Risperidone')], labels, ['appetite']);
    expect(m.map((x) => [x.symptom, x.days, x.fromPrep])).toEqual([
      ['sleepiness', 2, false],
      ['constipation', 1, false],
      ['appetite_up', 0, true],
    ]);
    expect(labelFor(med('Risperidone'), labels)?.generic).toBe('risperidone');
  });

  it('ignores stopped medicines and medicines without a label', () => {
    const labels = [label('risperidone', ['sleepiness'])];
    const events = [ev('health', '2026-11-01', { symptom_key: 'sleepiness' })];
    expect(labelMatches(events, [{ ...med('Risperidone'), active: false }], labels)).toEqual([]);
    expect(labelMatches(events, [med('Melatonin')], labels)).toEqual([]);
  });
});
