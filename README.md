# Dayline

**Every day, on one line.** A day record for families of autistic children, kept on the parent's phone: what happened, what changed, what helps. It's useful from the first day even if nobody logs anything. Show the next caregiver a simple brief, and send each doctor a PDF on WhatsApp. No accounts, no server.

Live site: https://tanzir71.github.io/dayline/

## Status

| Milestone | What ships | Status |
| --- | --- | --- |
| M0 | Landing page, Guides (knowledge base), Help now, installable offline PWA | In progress |
| M1 | The child on this phone: profile, medicines and reminders, quick log, Today, brief in show mode or as a PDF, backup | Not started |
| M2 | Visits and changes: visit prep, visit report PDF, change reviews, welcome back, patterns, label check | Not started |
| M3 | Desktop and passport: wide layouts, install on computers, hospital passport | Not started |

## How it's built

- [Astro](https://astro.build) static site with [Preact](https://preactjs.com) islands; the app lives at `/app/` with hash routing, so GitHub Pages needs no server routing.
- Child data stays in the browser's IndexedDB on the device. It leaves only as a PDF, a print or a backup file the parent chooses to send.
- Works offline through a service worker; Bangla and English throughout; fonts are self-hosted.
- Same-origin requests only: no analytics, no CDNs, no third-party scripts.

```
src/pages/        Routes (English at /, Bangla at /bn/)
src/views/        Page views shared by both languages
src/components/   UI components (Button, Chip, Overline, Guide row, …)
src/islands/      Interactive Preact islands
src/i18n/         en.json and bn.json UI strings
src/styles/       Tokens, fonts and styles
content/guides/   Guides in Markdown (en/ and bn/), see _TEMPLATE.md
content/calendar.json  Bangladesh seasonal routine changes
```

## Develop

Needs Node 24.

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run check
```

```bash
npm run test:e2e
```

`npm run check` runs type checks, lint and unit tests. `npm run test:e2e` builds the site under the `/dayline/` sub-path and runs the Playwright tests, including the offline test.

## Deploy

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`). The site URL and base path come from `PUBLIC_SITE_URL` and `PUBLIC_BASE_PATH`, so the same code works at `user.github.io/<repo>/` and on a custom domain.

## Before you launch

- Get every guide reviewed by a named clinician or trained parent (`status: reviewed` with `reviewed_by` and `reviewed_on`). Until then guides show a draft banner; turn off `PUBLISH_DRAFT_GUIDES` in `src/config/flags.ts` to hide them. Medicine guides are never published as drafts.
- Confirm the Islamic holiday dates in `content/calendar.json` each year.
- Data lives only on each phone. Families should use the monthly backup; a cleared browser or lost phone without one loses the record.
- Other apps already use the name "Dayline". Use a qualifier in stores, e.g. "Dayline: Autism Care Log", and check trademarks before buying a domain.

Not a medical device. Not medical advice.
