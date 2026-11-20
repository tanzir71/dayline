# Milestones

Every milestone is a working release on GitHub Pages and is useful on its own. Claude Code commits straight to `main`; each milestone goes live when its acceptance criteria pass, and the next one starts right away. **Build and deploy M0 to M3 back to back.** There are no accounts and no server: child data stays on the phone and leaves only as a PDF, a print or a backup file the parent chooses to send. Figma node IDs refer to file `hWA0tZUaRY535kNq6NZu09` (see `docs/DESIGN.md`).

| Milestone | Ships | Your check (doesn't block the next build) |
| --- | --- | --- |
| M0 | Landing page, Guides, Help now (general), install prompt, offline PWA | Get guides reviewed by a named clinician or trained parent |
| M1 | The child on this phone: profile, medicines and reminders, quick log, Today, Help now with playbook, brief in show mode or as a PDF, backup | Try it with a few families |
| M2 | Visits and changes: visit prep, visit report PDF, change reviews, welcome back, weekly check-in, patterns, label check | — |
| M3 | Desktop and passport: wide layouts and install on computers, hospital passport, print polish | — |
| Later | Not planned, each needs a server: parent tips community, sync between phones, Ask Dayline, wearables | Don't build |

---

## M0 · Landing page and guides

**Goal:** a family is asked to install Dayline on their phone, reads guides in Bangla or English and uses Help now in a hard moment, all offline, with no account and no data.

**Figma:** Landing page `2531:3` · Guides home `2530:509` · Guide article `2530:603` · Help now `2530:457` (M0 shows the general steps only, no playbook) · Brand sheet `2526:2` · Components section on the Foundations page.

### Tasks

| ID | Task |
| --- | --- |
| M0-01 | `git init -b main` if needed; move `setup/github/` to `.github/`; scaffold Astro + TypeScript + Preact, ESLint, Prettier, Vitest, Playwright; create the GitHub repo (`gh repo create`), enable Pages with the Actions source (`gh api repos/{owner}/{repo}/pages -X POST -f build_type=workflow`) and push. The site shows only what's finished; flags hide the rest. |
| M0-02 | Design tokens: import `design/tokens.css`; set up Fontsource fonts; base layout, typography classes mirroring the `Dayline/*` text styles. |
| M0-03 | Core components from Figma: Button (5 variants), Chip (3 states), Overline (7 tones), Guide row (6 tones), Category tile (6 tones). A `/dev/components` page in dev only. |
| M0-04 | i18n: `en`/`bn` string files, `/` and `/bn/` routes, language toggle that remembers the choice. |
| M0-05 | Landing page (desktop and phone widths) from `2531:3`, every section, copy from Figma, OG tags for WhatsApp previews. |
| M0-06 | Guides content collection with zod schema from `content/guides/_TEMPLATE.md`; draft banner behind `PUBLISH_DRAFT_GUIDES`; medicine drafts never published; build check for reviewed fields. |
| M0-07 | Guides home `/guides/`: search (Pagefind), "Browse" categories, category pages. In M0 the "For Rafi this week" strip shows seasonal picks from `content/calendar.json` (Eid, Ramadan, school holidays in Bangladesh). |
| M0-08 | Guide page template from `2530:603`: overline, title, reviewer line, numbered sections, "Print as picture steps" (print CSS), share link to the public guide page. "Save to playbook" is hidden until M1. |
| M0-09 | Help now page `/help-now/` from `2530:457`, general steps from the `help-now` guide; call buttons (configurable emergency number, 999 default for Bangladesh). No saving in M0. |
| M0-10 | PWA: manifest (name, icons incl. maskable, theme `#1A5F5A`, background `#F3F6F5`, `start_url`/`scope` with base path, shortcuts: Help now, Guides), service worker precaching shell, fonts, landing and all guides; offline fallback page. |
| M0-11 | Install prompt on mobile. Android/Chrome: catch `beforeinstallprompt`, show a bottom sheet "Install Dayline: works offline, opens in one tap" with Install and Not now; Install calls `prompt()`. iOS Safari: same sheet with "Tap Share, then Add to Home Screen" and a small illustration. Show on the first visit on a phone, after the page settles; never during Help now. "Not now" hides it for 7 days, then once more, then only from an "Install app" link in the menu and footer. Never shown when already installed (`display-mode: standalone` or `navigator.standalone`) or on desktop. Bangla and English. |
| M0-12 | `/privacy/` page ("No accounts. No server. Your child's data stays on your phone.") and `/app/` placeholder ("The app arrives in the next release. Install now to get it automatically."). |
| M0-13 | Tests: Playwright smoke (landing, guide, search, language switch, Help now, install sheet with a mocked `beforeinstallprompt`) and an offline test (load once, go offline, open a guide). Lighthouse CI for accessibility and PWA. |

### Acceptance criteria

- [ ] Deployed on GitHub Pages; works at the repo sub-path and on a custom domain with `PUBLIC_BASE_PATH`.
- [ ] On an Android phone, the first visit asks to install and Install adds Dayline to the home screen; long-press on the icon shows Help now and Guides.
- [ ] On an iPhone, the first visit shows the Add to Home Screen steps.
- [ ] The install sheet never appears once installed, on desktop or during Help now, and respects "Not now".
- [ ] After one online visit, airplane mode: landing, guides list, any guide and Help now all open.
- [ ] Every page has Bangla and English; switching keeps you on the same page.
- [ ] Search finds a guide by a Bangla or English word.
- [ ] Unreviewed guides show the draft banner; no medicine guide is published unreviewed.
- [ ] Lighthouse accessibility ≥ 95; PWA installable; no third-party requests at runtime.
- [ ] Pasting a guide URL into WhatsApp shows its title and description.

---

## M1 · The child on this phone

**Goal:** a parent sets up their child once and gets reminders, Help now with the child's own playbook and a day line, and can hand the next caregiver a brief by showing the phone or sending a PDF on WhatsApp, without ever "logging".

**Figma:** Today first week `2530:297` · Today with a logged day `2522:2` · Quick log `2523:76` · About Rafi `2530:754` · Share brief sheet `2540:198` · Handoff brief in show mode `2523:179` · Help now `2530:457` (with playbook) · Medicine guide `2530:650` (personal card only; label data in M2).

### Tasks

| ID | Task |
| --- | --- |
| M1-01 | Storage: Dexie (IndexedDB) behind `Repository` interfaces in `src/data/`, schema versions with forward-only migrations and tests, `navigator.storage.persist()`. |
| M1-02 | App shell at `/app/` with hash routing and the 4-tab nav (Today, Guides, Insights, child). Insights shows "Arrives in the next release" until M2. |
| M1-03 | Onboarding: add a child (name, birth month, language) in under 2 minutes, every field optional except the name; several children supported with a switcher. |
| M1-04 | About the child (profile) from `2530:754`: communication, pain and distress signs, what calms, what to avoid, medicines, food and allergies, sleep, people to call. Every section optional. |
| M1-05 | Medicines: schedule (times, amount text, with food), in-app reminders, "Mark given" (records who, when, late/missed), refill count with low-stock warning. Export the schedule as an `.ics` file with alarms so the phone's calendar reminds even when the app is closed. |
| M1-06 | Today from `2530:297` and `2522:2`: planned items from the schedule, events on the day line with who noted them, the "Now" marker, a Help now card, "For [child] this week" guide rows. No-guilt empty copy. |
| M1-07 | Quick log sheet from `2523:76`: kind, size 1–5, duration, place, just-before (multi), what helped (from playbook), "noted by" (Amma, Abbu, Nanu, teacher: names remembered), optional note. One tap saves a minimal entry. |
| M1-08 | Help now with playbook: starts a timer, shows the child's calming steps first, "Helped" taps, "It's over" saves a hard-moment event with start, end and what helped. |
| M1-09 | Playbook: "Save to playbook" on guides; playbook items feed Help now and the brief. |
| M1-10 | Share sheet from `2540:198`, opened from Today's share button and "Share his brief": language (English or Bangla), then Show on this phone, Send as PDF, Print or save. |
| M1-11 | Show mode from `2523:179`: full screen, large type, no nav or menus. Only Mark given, Call buttons and Done work. Done needs a 1-second press so a child can't leave by accident. Keep the screen awake (Screen Wake Lock API, where supported). |
| M1-12 | PDF engine in `src/domain/pdf/`: lay out A4 pages in HTML with print styles, render each page to an image on the device (e.g. `modern-screenshot`) and assemble with `pdf-lib`. Image pages are deliberate: PDF libraries can't shape Bangla text. JPEG at about 0.85 quality keeps files small for WhatsApp. File name like `Rafi-brief-2026-11-20.pdf`. Share with `navigator.share({ files })` when `navigator.canShare` allows it (Android Chrome → WhatsApp); otherwise download it and offer Print. The brief fits one page. Load this code only when sharing. |
| M1-13 | Backup: export everything as one file (JSON) and per-table CSV; share or save it the same way as a PDF; import a backup (replaces this phone's data after a confirm; no merge); a monthly "back up" reminder because data lives only on this phone. |
| M1-14 | Tests: repository and migration unit tests; Playwright for onboarding, mark dose given, Help now save, show mode (no way out except Done; Mark given logs), PDF generated with Bangla text, backup round-trip, offline Today; a test that fails on any request to another origin. |

### Acceptance criteria

- [ ] A new parent reaches a useful Today (schedule, Help now, guides) in under 2 minutes without logging anything.
- [ ] Marking a dose and ending Help now both create events that appear on the day line.
- [ ] Send as PDF on an Android phone opens the share sheet with WhatsApp; the one-page brief shows sleep, doses, food, watch-fors, what calms and contacts, and Bangla renders correctly.
- [ ] Show mode can't reach any other screen; Mark given there logs the dose; Done needs a press-and-hold.
- [ ] The `.ics` export imports into Google Calendar and fires alarms.
- [ ] Data survives app updates and a reload offline; export → clear → import restores it.
- [ ] No request ever leaves the site's own origin.

---

## M2 · Visits and changes

**Goal:** the parent walks into a visit with a useful report, even with little logged, sends it to the doctor's WhatsApp as a PDF or shows it on screen, and every change gets an honest before-and-after.

**Figma:** Visit prep `2530:706` · Visit report (desktop) `2524:284` · Change review `2523:256` · Patterns `2523:338` · Welcome back `2530:411` · Medicine guide `2530:650` (label sections).

### Tasks

| ID | Task |
| --- | --- |
| M2-01 | Prescribers and visits: add prescribers; schedule a visit; a "prep in 60 seconds" nudge 3 days before. |
| M2-02 | Visit prep from memory from `2530:706`: four quick questions plus the parent's own questions. |
| M2-03 | Visit report from `2524:284`: per prescriber, period since last visit, stats with data coverage, changes from every prescriber, weekly chart, label-matched symptoms, parent's questions. Works with zero logs (answers from memory) and improves with data. Shared through the M1 share sheet: two-page PDF to WhatsApp, show on screen, or print. |
| M2-04 | Changes from `2523:256`: record medicine start, dose change, stop, therapy, diet, school or routine change with reason, decided by, review date. Review screen compares 14 days before and after (skip the first 3 days), flags overlapping changes, shows counts and data coverage. |
| M2-05 | Welcome back from `2530:411`: shown after ≥ 7 days without opening; three yes/no questions; "while you were away" from events that still arrived (dose taps). |
| M2-06 | Weekly check-in: three taps (sleep, mood, hard moments: less / same / more), optional, at a time the parent picks. |
| M2-07 | Patterns engine (Web Worker): daily table, with-vs-without comparisons and next-day lag, minimum 7 days in each group, time-of-day chart. "Makes sense / Not this" feedback. Unit-test the statistics. |
| M2-08 | Label check: a GitHub Action fetches openFDA label sections (indications, adverse reactions, warnings) for a curated list of medicines at build time into static JSON; the medicine guide shows them with source and date; new symptoms that match a label appear as a question for the prescriber. |
| M2-09 | Insights tab: change reviews and patterns, with clear "still learning: 4 of 7 days" states. |
| M2-10 | Tests: statistics unit tests with fixtures; Playwright for visit prep → report PDF, change → review. |

### Acceptance criteria

- [ ] With zero logged days, visit prep still produces a two-page PDF report.
- [ ] The report PDF opens in WhatsApp on Android and prints cleanly on A4.
- [ ] A change review shows before/after counts, the number of days each side rests on, and flags any overlapping change.
- [ ] No pattern appears with fewer than 7 days in either group; every pattern opens its raw days.
- [ ] Welcome back appears after a 7-day gap and never shows a backlog to fill.
- [ ] Medicine pages show source and fetch date; nothing suggests doses.

---

## M3 · Desktop and passport

**Goal:** Dayline works well on a computer, for the parent who plans visits at a desk, and gives the family a one-page hospital passport.

**Figma:** Visit report (desktop) `2524:284` is the reference for wide layouts. The hospital passport and wide app layouts are not designed yet: design them in Figma first (from the brief and visit report styles), then build.

### Tasks

| ID | Task |
| --- | --- |
| M3-01 | Wide layouts from 1024 px: two panes for Today (day line and detail), full-width Insights and visit report, the nav as a left rail. |
| M3-02 | Install on computers: an "Install app" button in the header on desktop Chrome and Edge (`beforeinstallprompt`); no bottom sheet on desktop. |
| M3-03 | Keyboard: `N` new moment, `D` dose given, `/` search guides, `Esc` closes sheets; all with visible focus. |
| M3-04 | Hospital passport: one-page PDF and a show-mode view, in Bangla and English, built from About the child: how he communicates, signs of pain and distress, medicines and allergies, what calms, what to avoid, who to call. Shared through the share sheet. |
| M3-05 | Move data between devices: export a backup on the phone, import it on the computer (and back), with a clear "this replaces the data here" confirm. |
| M3-06 | Print polish: every PDF and print view checked on A4 and Letter, in both languages. |
| M3-07 | Tests: Playwright at 1440 px for Today, Insights and visit report; passport PDF in Bangla. |

### Acceptance criteria

- [ ] On a desktop browser, Dayline installs as an app and opens in its own window.
- [ ] At 1440 px no screen is a stretched phone layout.
- [ ] The passport fits one A4 page in both languages and shares to WhatsApp from a phone.
- [ ] A backup made on a phone imports on a computer with everything intact.

---

## Later (not planned)

Each of these needs a server, accounts or moderators, which Dayline deliberately doesn't have. Don't build them. The Figma section "Parked · Community" keeps the parent tips design for reference.

- Parent tips community with tried-it outcomes and moderation.
- Sync between two parents' phones (today one phone holds the record; a backup file copies it once).
- Ask Dayline (questions answered from the guides).
- Wearables study with a partner clinic.
- A store-listed desktop app (Tauri); the installed PWA covers desktop for now.
