# Design

**Figma file:** SEVA Design — `https://www.figma.com/design/hWA0tZUaRY535kNq6NZu09/SEVA-Design` (file key `hWA0tZUaRY535kNq6NZu09`).
Open any node with `https://www.figma.com/design/hWA0tZUaRY535kNq6NZu09/SEVA-Design?node-id=<id with - instead of :>`.

With the Figma MCP server: `get_design_context(fileKey: "hWA0tZUaRY535kNq6NZu09", nodeId: "<id>")`. Treat the generated code as a reference; build with this repo's components and `design/tokens.css`.

## Pages

| Page | Node | Contents |
| --- | --- | --- |
| Cover | `2519:4105` | Title card |
| v2 · Dayline — Screens | `2519:4106` | All app screens, grouped in sections by flow, each with a documentation card |
| v2 · Dayline — Landing page | `2531:2` | Landing page (desktop 1440) |
| v2 · Dayline — Foundations | `2519:4107` | Brand sheet, colour variables, text styles, components |
| v1 · … | | Old Seva v1, for reference only |

## Screens

| Screen | Node | Milestone |
| --- | --- | --- |
| Landing page (desktop) | `2531:3` | M0 |
| Guides (knowledge base home) | `2530:509` | M0 |
| Guide article · Haircut day | `2530:603` | M0 |
| Help now | `2530:457` | M0 general, M1 with playbook |
| Today · first week, nothing logged | `2530:297` | M1 |
| Today · a logged day | `2522:2` | M1 |
| Quick log | `2523:76` | M1 |
| About Rafi (child profile) | `2530:754` | M1 |
| Share brief (sheet: show, PDF, print) | `2540:198` | M1 |
| Handoff brief in show mode | `2523:179` | M1 |
| Medicine guide · Risperidone | `2530:650` | M1 personal card, M2 label data |
| Welcome back | `2530:411` | M2 |
| Visit prep in 60 seconds | `2530:706` | M2 |
| Visit report (desktop; also the 2-page PDF layout) | `2524:284` | M2, wide layout reference for M3 |
| Change review | `2523:256` | M2 |
| Patterns | `2523:338` | M2 |
| Parent tips | `2524:194` | Parked, not planned (section "Parked · Community") |

Phone frames are 412 × 917 (Android-first). Build them responsive: single column up to 600 px, then a centred 480 px column for app screens on larger windows; the visit report and landing page are full-width pages.

Not designed yet: install sheet (M0; build it from the Button component and the Share brief sheet style), onboarding, settings, Insights tab list, medicine schedule editor, playbook list, backup screen (follow existing patterns for these M1–M2 screens); hospital passport and wide app layouts (M3; design in Figma first); Bangla variants of every screen (layout must allow ~30% longer strings).

PDF pages are A4. Build the brief PDF from the show-mode brief's content and the visit report PDF from the desktop visit report, in print styles (white background, no nav, footer with child's name, date and "Made with Dayline").

## Components (Foundations page)

| Component | Node | Variants and properties |
| --- | --- | --- |
| Button | `2521:12` | Variant = Primary, Secondary, Hard moment, Win, Dose · text `Label` · 52 px tall, radius 16 |
| Chip | `2521:19` | State = Default, Selected (single choice), Toggled (multi choice) · text `Label` · 44 px tall, radius 22 |
| Overline | `2521:41` | Tone = Marigold, Win, Medicine, Sleep, Hard moment, Food, Neutral · text `Label` |
| Status tile | `2521:67` | Tone = Sleep, Food, Hard moment, Medicine, Win · text `Label`, `Value` |
| Timeline item | `2521:122` | Type = Sleep, Medicine, Food, School, Hard moment, Win, Now · text `Time`, `Title`, `Detail` |
| Nav bar | `2521:253` | Active = Today, Guides, Insights, Rafi (child) · 4 tabs |
| Guide row | `2529:180` | Tone = Win, Medicine, Sleep, Food, Hard moment, Neutral · text `Title`, `Meta` |
| Category tile | `2529:315` | Tone = same as Guide row · text `Label`, `Count` |
| Brand sheet | `2526:2` | Logo, app icon, palette, type, voice |

## Tokens

Use `design/tokens.css` (CSS custom properties) generated from the Figma "Dayline" variable collection and `Dayline/*` text styles. Colour means the kind of moment everywhere: Ember = hard moment, Leaf = win, Dusk = sleep, River = medicine, Wheat = food and gut, Marigold = "now" and new insights only. Never use red for alarm.

Type: Bricolage Grotesque (headings, numbers), Figtree (UI and body), Hind Siliguri (Bangla). Minimum body 14 px; captions 13 px.

## Icons

Inline stroke SVGs, 2 px stroke, round caps, 20–24 px. The nav icons (Today line-with-dots, Guides book, Insights bars, child person) are in the Nav bar component; export them from Figma or copy the paths with `get_design_context`.

## Brand

Name: Dayline (Bangla: ডেলাইন). Tagline: "Every day, on one line." The wordmark is lowercase "dayline" with a horizon line and a marigold "now" dot. Store listing name should add a qualifier (e.g. "Dayline: Autism Care Log") because other apps use "Dayline".
