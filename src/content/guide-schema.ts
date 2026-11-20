import { z } from 'astro/zod';

/** Guide categories as written in frontmatter (content/guides/_TEMPLATE.md). */
export const CATEGORIES = ['everyday', 'medicines', 'sleep', 'food-gut', 'hard-moments', 'school-rights', 'services'] as const;
export type Category = (typeof CATEGORIES)[number];

/** The six "Browse" tiles on the Guides home; school-rights and services share one tile. */
export const BROWSE = {
  everyday: ['everyday'],
  medicines: ['medicines'],
  sleep: ['sleep'],
  'food-gut': ['food-gut'],
  'hard-moments': ['hard-moments'],
  'school-services': ['school-rights', 'services'],
} as const satisfies Record<string, readonly Category[]>;
export type BrowseKey = keyof typeof BROWSE;
export const BROWSE_KEYS = Object.keys(BROWSE) as BrowseKey[];

export const BROWSE_TONE: Record<BrowseKey, 'win' | 'medicine' | 'sleep' | 'food' | 'hard-moment' | 'neutral'> = {
  everyday: 'win',
  medicines: 'medicine',
  sleep: 'sleep',
  'food-gut': 'food',
  'hard-moments': 'hard-moment',
  'school-services': 'neutral',
};

export function browseKeyFor(category: Category): BrowseKey {
  return (BROWSE_KEYS.find((k) => (BROWSE[k] as readonly Category[]).includes(category)) ?? 'everyday') as BrowseKey;
}

const isoDate = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? '').trim()));

export const guideSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    slug: z.string().regex(/^[a-z0-9-]+$/, 'slug: lowercase letters, digits and dashes'),
    lang: z.enum(['en', 'bn']),
    category: z.enum(CATEGORIES),
    summary: z.string().trim().min(1, 'summary is used for search and WhatsApp previews'),
    read_minutes: z.number().int().positive(),
    status: z.enum(['draft', 'reviewed']),
    reviewed_by: z.string().optional().transform((v) => (v ?? '').trim()),
    reviewed_on: isoDate,
    translation_of: z.string().optional().transform((v) => (v ?? '').trim()),
    tags: z.array(z.string()).default([]),
    age_range: z.string().optional(),
    tone: z.enum(['win', 'medicine', 'sleep', 'food', 'hard-moment', 'neutral']).default('neutral'),
    sources: z
      .array(z.object({ title: z.string().optional(), url: z.string().optional() }))
      .default([])
      .transform((list) =>
        list.filter((s) => s.title?.trim() || s.url?.trim()).map((s) => ({ title: s.title?.trim() || s.url!.trim(), url: s.url?.trim() ?? '' })),
      ),
    playbook_items: z.array(z.string()).default([]),
    seasonal: z.array(z.string()).default([]),
  })
  .superRefine((g, ctx) => {
    if (g.status === 'reviewed') {
      if (!g.reviewed_by) ctx.addIssue({ code: 'custom', path: ['reviewed_by'], message: 'A reviewed guide needs reviewed_by' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(g.reviewed_on)) {
        ctx.addIssue({ code: 'custom', path: ['reviewed_on'], message: 'A reviewed guide needs reviewed_on (YYYY-MM-DD)' });
      }
    }
  });

export type GuideData = z.output<typeof guideSchema>;

/**
 * Publishing rules: reviewed guides always publish; drafts publish (with a banner) only while
 * PUBLISH_DRAFT_GUIDES is on; medicine drafts never publish.
 */
export function isPublished(g: Pick<GuideData, 'status' | 'category'>, publishDrafts: boolean): boolean {
  if (g.status === 'reviewed') return true;
  if (g.category === 'medicines') return false;
  return publishDrafts;
}
