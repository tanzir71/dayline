# Dayline — instructions for Claude Code

Dayline is a day record for families of autistic children, kept on the parent's phone: what happened, what changed, what helps. It is built and shipped in **milestones (M0–M3)**. Every milestone is a working, deployed release on **GitHub Pages**. Read this file first, then `docs/MILESTONES.md` for the milestone you are working on.

## Read before you write code

| File | What it gives you |
| --- | --- |
| `docs/MILESTONES.md` | Scope, tasks and acceptance criteria per milestone. Work only on the current milestone. |
| `docs/PRODUCT.md` | Who it is for, principles, features, voice and copy rules. |
| `docs/DESIGN.md` | Figma file key and node IDs for every screen and component, tokens, layout rules. |
| `docs/ARCHITECTURE.md` | Stack, routes, storage, offline, show mode and PDF sharing, GitHub Pages constraints. |
| `docs/DATA_MODEL.md` | Local entities, derived views, migrations and backup format. |
| `design/tokens.json`, `design/tokens.css` | Colours, type, radii and spacing from the Figma variables. Use these, never raw hex. |
| `content/guides/` | Knowledge-base guides (Markdown + frontmatter). See `content/guides/_TEMPLATE.md` and `BACKLOG.md`. |
| `docs/RESEARCH.md` | The full research and concept doc (competitors, evidence, compliance, sources). Background, not a task list. It predates the decision to drop sync, links, accounts and the community; where it differs, the other docs win. |

The design source of truth is the Figma file **SEVA Design** (file key `hWA0tZUaRY535kNq6NZu09`), pages "v2 · Dayline — Screens", "v2 · Dayline — Landing page" and "v2 · Dayline — Foundations". If the Figma MCP server is connected, call `get_design_context` with that file key and the node ID listed in `docs/DESIGN.md` for the screen you are building, and adapt the result to this codebase's components and tokens. The concept and research doc is linked in `README.md`.

## Non-negotiables

1. **Useful with nothing logged.** Every screen must have a helpful empty state. No streaks, no guilt copy, no "you haven't logged" messages. Nudges only for real events (install on first visit, dose due, refill low, visit soon, routine change from the calendar, monthly backup).
2. **Never medical advice.** No dose suggestions, no "stop/start" suggestions, no diagnosis language. Medicine content comes from official label data and is framed as questions for the prescriber. Patterns are worded "seen together, 6 of 8 times", never "X causes Y".
3. **Nothing leaves the phone by itself.** No accounts, no server, no cloud. Child data lives in IndexedDB on the device and leaves only as a PDF, a print or a backup file the parent chooses to send. Same-origin requests only: no analytics, no CDNs, no third-party scripts. Self-host fonts.
4. **Bangla and English parity.** Every UI string goes through i18n (`src/i18n/en.json`, `src/i18n/bn.json`). Bangla text uses Hind Siliguri. Set `lang` correctly per page.
5. **Accessible as built.** Touch targets ≥ 44 px, text contrast ≥ 4.5:1, real `<button>`/`<a>`/`<label>`, visible focus, works with TalkBack. Colour is never the only signal (event dots also have labels).
6. **Works offline and on slow networks.** Pages must load from the service worker cache in airplane mode after first visit.
7. **Each milestone ships on its own.** Do not leave half-built features reachable in production; hide unfinished work behind `src/config/flags.ts`.

## Stack (decided; ask before changing)

- **Astro** (static output) for the landing page, guides and static pages, with **Preact** islands for interactive parts. The app lives at `/app/` as a client-only Preact island with **hash routing** (`/app/#/today`) so GitHub Pages never needs server routing.
- **TypeScript** strict. **Vitest** for logic, **Playwright** for smoke tests (including an offline test).
- **PWA** via `@vite-pwa/astro` (Workbox). Manifest shortcuts: Help now, Dose given, Log a moment (Chrome on Android shows the first three).
- **Search** for guides with **Pagefind** (static index built at build time, works on GitHub Pages).
- **Storage**: Dexie (IndexedDB) behind `Repository` interfaces in `src/data/`. No backend.
- **PDF**: HTML page layouts rendered to images on the device (e.g. `modern-screenshot`) and assembled with `pdf-lib`, because PDF libraries can't shape Bangla text. Shared with the Web Share API (`navigator.share({ files })`), so Android offers WhatsApp.
- **Fonts**: Fontsource packages for Bricolage Grotesque, Figtree and Hind Siliguri, bundled.

## GitHub Pages rules

- Deploy with `.github/workflows/deploy.yml` on push to `main` (shipped in `setup/github/`; M0-01 moves it to `.github/`). Do not commit build output.
- Set Astro `site` and `base` from env (`PUBLIC_BASE_PATH`) so the repo works both as `user.github.io/<repo>/` and on a custom domain.
- GitHub Pages cannot set response headers. Anything that needs COOP/COEP or custom CSP headers is out; use `<meta http-equiv="Content-Security-Policy">` where possible.
- Dayline has no accounts and no server, which suits Pages. GitHub's terms say Pages isn't for commercial SaaS; check them before charging money.
- Service worker scope and manifest `start_url`/`scope` must include the base path.

## How to work a milestone

Work directly on `main`. No branches, no pull requests.

1. Read the milestone in `docs/MILESTONES.md` and build its tasks in the listed order.
2. Commit each finished task straight to `main`, with a message that names the task ID (e.g. `M0-04: guide page template`), and push.
3. For each screen, pull design context from Figma by node ID and match tokens, spacing and copy. Copy in Figma is the default copy; i18n keys mirror it.
4. Before every push, run `npm run check` (types, lint, unit tests) and `npm run test:e2e` (Playwright, includes offline). Every push to `main` deploys to GitHub Pages, so `main` must always be usable: screens that aren't finished stay hidden behind `src/config/flags.ts`.
5. When every acceptance criterion passes: tick them in `docs/MILESTONES.md`, switch the milestone's flags on, push, tag `v0.<N>.0`, update `CHANGELOG.md` and the status table in `README.md`, and tell the user the live URL.
6. Then start the next milestone. Build and deploy M0 to M3 back to back without stopping. Never build anything under "Later" in `docs/MILESTONES.md`: no accounts, sync, server or community.

## Content rules for guides

- Guides live in `content/guides/<lang>/<slug>.md` with the frontmatter in `_TEMPLATE.md`.
- `status: draft` guides are published with a visible "Draft — not yet reviewed by a clinician" banner while `PUBLISH_DRAFT_GUIDES` is on in `src/config/flags.ts`, so the library is usable before reviews come in. Medicine guides are never published as drafts. Builds fail if a guide marked `reviewed` lacks `reviewed_by` or `reviewed_on`.
- Never write or publish medical content yourself as final. You may draft structure and plain-language wording for review, always as `status: draft`.
- Never list unproven or harmful "treatments".

## Done means

Deployed on GitHub Pages, acceptance criteria ticked, offline test green, Lighthouse accessibility ≥ 95 and PWA installable, Bangla strings present, README milestone table updated.
