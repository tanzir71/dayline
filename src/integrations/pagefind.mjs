// Builds the Pagefind search index right after Astro writes dist/, before the PWA integration
// generates the service worker, so the index is precached and search works offline.
import { fileURLToPath } from 'node:url';
import * as pagefind from 'pagefind';

/** @returns {import('astro').AstroIntegration} */
export default function pagefindIntegration() {
  return {
    name: 'dayline-pagefind',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const site = fileURLToPath(dir);
        const { index, errors } = await pagefind.createIndex({});
        if (!index) throw new Error(`Pagefind: ${errors.join(', ')}`);
        const added = await index.addDirectory({ path: site });
        if (added.errors.length) throw new Error(`Pagefind: ${added.errors.join(', ')}`);
        await index.writeFiles({ outputPath: `${site}pagefind` });
        await pagefind.close();
        logger.info(`indexed ${added.page_count} pages`);
      },
    },
  };
}
