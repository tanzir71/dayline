# Architecture

## Overview

One static site on GitHub Pages: Astro pages for the landing page and guides, a Preact app at `/app/` (hash routing), and a service worker that caches everything for offline use. There is **no server and no accounts**. Child data lives in the browser's IndexedDB on the device. It leaves only as a PDF, a print or a backup file the parent chooses to share, and those files are made on the device.

```
/                 Landing (en)            M0
/bn/              Landing (bn)            M0
/guides/          Guides home + search    M0
/guides/<slug>/   Guide page              M0
/help-now/        Help now (general)      M0
/privacy/         Privacy                 M0
/app/#/today      App (Preact, hash)      M1+
/app/#/show/...   Show mode               M1
```

## Repository layout (target)

```
src/
  pages/            Astro routes (landing, guides, help-now, privacy, app)
  layouts/          Base layout, guide layout
  components/       Button, Chip, Overline, GuideRow, CategoryTile, TimelineItem, NavBar, StatusTile, InstallSheet, ShareSheet
  app/              Preact app: routes, screens, state
  data/             Repository interfaces, Dexie adapter, migrations, backup
  domain/           Pure logic: day line, brief, change review stats, patterns, ics
  domain/pdf/       Page layouts, render-to-image, PDF assembly, share
  i18n/             en.json, bn.json
  config/flags.ts   Feature flags (unfinished screens, PUBLISH_DRAFT_GUIDES)
content/
  guides/en, guides/bn
  calendar.json     Seasonal events for Bangladesh (Ramadan, Eid, school holidays)
  medicines.json    Local brand → generic names (M2)
design/             tokens.json, tokens.css
public/             icons, manifest assets
```

## Offline and PWA

- `@vite-pwa/astro` with Workbox: precache the shell, fonts, landing, guides and search index; runtime cache for anything else same-origin.
- Manifest: `name` "Dayline", `short_name` "Dayline", `theme_color` `#1A5F5A`, `background_color` `#F3F6F5`, `display` standalone, `start_url` and `scope` = base path, maskable icons 192/512.
- Shortcuts (Android shows the first three): Help now, Dose given (M1), Log a moment (M1). In M0: Help now, Guides.
- Fonts self-hosted via Fontsource.
- Install prompt (`InstallSheet`): Android/Chrome uses the deferred `beforeinstallprompt` event; iOS has no install API, so show the Add to Home Screen steps. Desktop (M3) gets a header button instead of a sheet. Store dismissals in `localStorage` (wrapped in try/catch).

## Storage

- Dexie over IndexedDB. All access goes through `Repository` interfaces (`ChildRepo`, `EventRepo`, `MedicineRepo`, `ChangeRepo`, `PlaybookRepo`, …).
- Schema versions with forward-only migrations; a test for each.
- Call `navigator.storage.persist()`. Browsers can still clear storage, and a lost phone loses the data, so backups matter: monthly reminder, one-tap export.
- Backup file: `dayline-backup-v1.json` = `{ version, exported_at, tables: { … } }`, shared or saved like a PDF. Import replaces the data on that device after a confirm; there is no merge.

## Sharing without a server

- **Share sheet** (M1): choose English or Bangla, then one of three ways out.
- **Show mode:** a route that renders the brief (or report, or passport) full screen with large type and no navigation. Only Mark given, Call and Done work; Done needs a 1-second press. Uses the Screen Wake Lock API where supported.
- **PDF:** lay out A4 pages as HTML with print styles, render each page to an image on the device (`modern-screenshot` or similar), and assemble with `pdf-lib`. Pages are images because PDF libraries can't shape Bangla script. JPEG around 0.85 quality keeps a page near 150–300 KB. Share with `navigator.share({ files: [pdf] })` when `navigator.canShare({ files })` is true (Android Chrome shows WhatsApp); otherwise download the file and offer Print.
- **Print:** the same HTML page layouts through the browser's print dialog (selectable text, best quality on desktop).
- **Calendar:** `.ics` file with `RRULE` and `VALARM` for medicine times and visits.

## Medicine label data (M2)

A scheduled GitHub Action calls the openFDA drug label endpoint for a curated medicine list, keeps the indications, adverse reactions and warnings sections plus the fetch date, and commits static JSON. The app never calls openFDA at runtime. Local brand names map to generic names in `content/medicines.json`.

## Patterns (M2)

Pure functions in `src/domain/patterns.ts`, run in a Web Worker: build a daily table, compare with-vs-without for each factor with same-day and next-day lag, require ≥ 7 days per group, return counts and coverage. Change reviews compare 14 days before and after, skipping the first 3 days, and flag overlapping changes. All logic unit-tested with fixtures.

## Network

Same-origin requests only, always. No analytics, no CDNs, no third-party fonts. A Playwright test fails on any request to another origin.

## Hosting

GitHub Pages fits: static files, no accounts, no data on a server. Pages can't set response headers, so use a `<meta>` Content-Security-Policy. GitHub's terms say Pages isn't for commercial SaaS; check them before charging money.

## Quality gates

Type check, lint, Vitest, Playwright (including offline and the other-origin check), Lighthouse (accessibility ≥ 95, PWA installable), content check (reviewed fields, medicine drafts excluded), bundle budget for `/app/` (≤ 200 KB gzipped JS, not counting the PDF code, which loads only when sharing).
