import { getCollection, type CollectionEntry } from 'astro:content';
import { flags } from '../config/flags';
import { isPublished, browseKeyFor, BROWSE, type BrowseKey } from '../content/guide-schema';
import type { Lang } from './paths';

export type Guide = CollectionEntry<'guides'>;

/** Guides that build into the site, per the publishing rules in guide-schema.ts. */
export async function publishedGuides(lang?: Lang): Promise<Guide[]> {
  const all = await getCollection('guides', (g) => isPublished(g.data, flags.PUBLISH_DRAFT_GUIDES));
  return all
    .filter((g) => !lang || g.data.lang === lang)
    .sort((a, b) => a.data.title.localeCompare(b.data.title, a.data.lang));
}

export function guidesInBrowse(guides: Guide[], key: BrowseKey): Guide[] {
  return guides.filter((g) => (BROWSE[key] as readonly string[]).includes(g.data.category));
}

export { browseKeyFor };

/** The same guide in the other language, if it is published. */
export function translationOf(guide: Guide, all: Guide[]): Guide | undefined {
  return all.find((g) => g.data.slug === guide.data.slug && g.data.lang !== guide.data.lang);
}
