// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { AstroPWAIntegration as AstroPWA } from '@vite-pwa/astro';
import rehypeGuide from './src/lib/rehype-guide.mjs';
import pagefind from './src/integrations/pagefind.mjs';

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
  markdown: { rehypePlugins: [rehypeGuide] },
  devToolbar: { enabled: false },
  integrations: [
    preact(),
    // Must run before AstroPWA so the search index is in the precache manifest.
    pagefind(),
    AstroPWA({
      base,
      scope: base,
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        id: base,
        name: 'Dayline',
        short_name: 'Dayline',
        description: 'A day record for families of autistic children, kept on your phone. Works offline.',
        lang: 'en',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1A5F5A',
        background_color: '#F3F6F5',
        categories: ['health', 'lifestyle', 'medical'],
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}icons/maskable-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `${base}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Android shows the first three on long-press. M1 adds Dose given and Log a moment.
        shortcuts: [
          {
            name: 'Help now',
            short_name: 'Help now',
            description: 'Calm steps for a hard moment',
            url: `${base}help-now/`,
            icons: [{ src: `${base}icons/shortcut-help-now.png`, sizes: '96x96', type: 'image/png' }],
          },
          {
            name: 'Guides',
            short_name: 'Guides',
            description: 'Guides for everyday situations',
            url: `${base}guides/`,
            icons: [{ src: `${base}icons/shortcut-guides.png`, sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        // Precache the whole static site: pages, styles, scripts, Latin + Bengali fonts, icons and the search index.
        globPatterns: [
          '**/*.{html,css,js,mjs,svg,png,json}',
          '_astro/*-latin-*.woff2', // includes latin-ext
          '_astro/*-bengali-*.woff2',
          'pagefind/**/*.{pagefind,pf_meta,pf_index,pf_fragment,pf_filter}',
        ],
        globIgnores: [
          '**/node_modules/**',
          'og/**',
          // GitHub Pages serves 404.html itself; as a clean URL it would not resolve and break install.
          '404.html',
          // Pagefind's ready-made UIs: Dayline uses its own search UI.
          'pagefind/pagefind-ui.*',
          'pagefind/pagefind-modular-ui.*',
          'pagefind/pagefind-component-ui.*',
          'pagefind/pagefind-highlight.js',
        ],
        // Pagefind adds ?ts= to its entry file; match the precached copy anyway.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^ts$/],
        directoryIndex: 'index.html',
        cleanURLs: true,
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Pages not in the precache (e.g. added after this phone cached the site): network first,
            // the offline page when there is no connection.
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 6,
              precacheFallback: { fallbackURL: `${base}offline/` },
            },
          },
          {
            urlPattern: ({ sameOrigin }) => sameOrigin,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'assets', expiration: { maxEntries: 200 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
