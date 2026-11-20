// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import rehypeGuide from './src/lib/rehype-guide.mjs';

/** PUBLIC_SITE_URL: origin only, e.g. https://user.github.io or https://dayline.example */
const site = process.env.PUBLIC_SITE_URL || 'https://tanzir71.github.io';
/** PUBLIC_BASE_PATH: '/repo-name' for a project site, '' or '/' for a custom domain. */
const rawBase = process.env.PUBLIC_BASE_PATH ?? '';
const trimmed = rawBase.replace(/^\/+|\/+$/g, '');
const base = trimmed ? `/${trimmed}/` : '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory', assets: '_astro' },
  integrations: [preact()],
  markdown: { rehypePlugins: [rehypeGuide] },
  devToolbar: { enabled: false },
});
