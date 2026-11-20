import { describe, it, expect } from 'vitest';
import { guideSchema, isPublished, browseKeyFor } from './guide-schema';

const base = {
  title: 'Haircut day',
  slug: 'haircut-day',
  lang: 'en',
  category: 'everyday',
  summary: 'Plan a calmer haircut.',
  read_minutes: 4,
  status: 'draft',
  reviewed_by: '',
  reviewed_on: '',
};

describe('guide frontmatter schema', () => {
  it('accepts a draft without reviewer fields', () => {
    expect(guideSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a reviewed guide without reviewed_by or reviewed_on', () => {
    const r = guideSchema.safeParse({ ...base, status: 'reviewed' });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('reviewed_by');
    expect(paths).toContain('reviewed_on');
  });

  it('accepts a reviewed guide with both fields (YAML dates too)', () => {
    const r = guideSchema.safeParse({ ...base, status: 'reviewed', reviewed_by: 'Dr. N. Rahman', reviewed_on: new Date('2026-11-02') });
    expect(r.success).toBe(true);
    expect(r.success && r.data.reviewed_on).toBe('2026-11-02');
  });

  it('rejects an empty summary (used for previews)', () => {
    expect(guideSchema.safeParse({ ...base, summary: ' ' }).success).toBe(false);
  });

  it('drops empty source rows from the template', () => {
    const r = guideSchema.parse({ ...base, sources: [{ title: '', url: '' }] });
    expect(r.sources).toEqual([]);
  });
});

describe('publishing rules', () => {
  it('publishes reviewed guides always', () => {
    expect(isPublished({ status: 'reviewed', category: 'medicines' }, false)).toBe(true);
  });
  it('publishes drafts only with the flag on', () => {
    expect(isPublished({ status: 'draft', category: 'sleep' }, true)).toBe(true);
    expect(isPublished({ status: 'draft', category: 'sleep' }, false)).toBe(false);
  });
  it('never publishes a medicine draft', () => {
    expect(isPublished({ status: 'draft', category: 'medicines' }, true)).toBe(false);
  });
  it('groups school and services into one browse tile', () => {
    expect(browseKeyFor('services')).toBe('school-services');
    expect(browseKeyFor('school-rights')).toBe('school-services');
  });
});
