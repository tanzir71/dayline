# Changelog

Each milestone release is tagged `v0.<milestone>.0` and deployed to GitHub Pages.

## Android app v1.0.0 (2026-11-22)

- Speak (Android app only): say what happened in Bangla or English, or type it. A rule-based parser on the phone turns it into day-line entries, saved at once with Undo.
- Entries saved by voice show “voice”. Quick log can now fix a saved entry.
- Android app: native file sharing, back button, shortcuts, dose reminder notifications, and Settings · This app.
- Website: Android band, /android/ install page, an Android option in the install sheet and an Android section on the privacy page. These appear once an APK has been released.

## v0.3.0 — M3: Desktop and passport (2026-11-21)

- Wide layouts from 1024 px: a left rail instead of the tab bar, Today in two panes, Insights in three columns, the visit report full width, sheets as centred dialogs.
- Install Dayline on a computer from the header (Chrome and Edge); it opens in its own window.
- Keyboard: N logs a moment, D a dose, / searches guides, Esc closes.
- Hospital passport: one A4 page and a show-mode view, in Bangla or English, built from About the child; shared like the brief.
- Move the record between a phone and a computer with a backup file (the confirm says it replaces the data on that device).
- Print views fit A4 and Letter: brief and passport on one page, the visit report on two.

## v0.2.0 — M2: Visits and changes (2026-11-21)

- Doctors and therapists, planned visits, and a "prep in 60 seconds" nudge three days before.
- Visit prep from memory (four quick answers and your questions) and a visit report per prescriber: counts with coverage, changes from every prescriber, a weekly chart, symptoms that match a medicine label (as questions), and your questions. Works with nothing logged. Two-page PDF for WhatsApp, on screen, or printed.
- Changes with reason, who decided and a review date; adding, editing or stopping a medicine notes one automatically. Reviews compare 14 days before and after (first 3 days left out) and flag overlapping changes.
- Welcome back after 7 days away: three yes/no questions, never a backlog.
- Optional weekly check-in: sleep, mood, hard moments.
- Patterns, computed on the phone in a background worker: shown only with at least 7 days in each group, as counts ("8 of 10 days"), each opening its raw days; time of day; Makes sense / Not this.
- Official label sections (openFDA, refreshed weekly at build time) on each medicine page, with source and dates.

## v0.1.0 — M1: The child on this phone (2026-11-21)

- The app at /app/ (English) and /bn/app/ (Bangla): set up a child in under two minutes (only the name is needed), several children with a switcher.
- Today: planned doses, the day line with who noted each moment, the Now marker, Help now, seasonal guides, refill and monthly backup nudges. Nothing to fill in.
- Quick log for hard moments, wins, doses, sleep, food, school, health and notes; one tap saves.
- Medicines: schedules, in-app reminders, Mark given (late after 30 minutes), refill countdown, and a calendar file with alarms for the phone.
- About the child, people to call, and a playbook filled from the guides' Save to playbook.
- Help now with the child's own playbook; It's over saves the moment with what helped.
- Share the brief: show mode (locked; Done needs a one-second press; screen stays awake), a one-page PDF made on the phone (Bangla included) for WhatsApp, or print.
- Backup to a file (JSON and CSV) and restore; everything stays on the phone.
- An installed Dayline opens Today; long-press offers Help now, Dose given and Log a moment.

## v0.0.0 — M0: Landing page and guides (2026-11-21)

- Landing page in English and Bangla with every section of the design, Open Graph tags and a preview image for WhatsApp.
- Guides: 20 guides in English and 20 in Bangla, published as drafts with a visible "not yet reviewed" banner until a clinician reviews them; medicine drafts are never published. Search in both languages (works offline), seasonal "This week" picks from the Bangladesh calendar, six topic pages, print as picture steps, share.
- Help now: calm general steps, a running clock and an emergency call button (999 by default, changeable).
- Installable offline PWA: every page, the fonts and the search index are saved after the first visit; Help now and Guides shortcuts; offline and 404 pages.
- Install sheet on phones: Install on Android, Add to Home Screen steps on iPhone; respects Not now.
- Privacy page and an app placeholder. No accounts, no server, no third-party requests.
- Tests: Playwright smoke, install sheet, offline and installability checks; Lighthouse accessibility 100 on every page.
