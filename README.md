# Dayline

**Every day, on one line.** A day record for families of autistic children, kept on the parent's phone: what happened, what changed, what helps. It's useful from the first day even if nobody logs anything. Show the next caregiver a simple brief on the phone, and send each doctor a PDF on WhatsApp. No accounts, no server.

This repository starts as a handoff package for Claude Code. Each milestone ships as a working release on GitHub Pages.

## Status

| Milestone | What ships | Status |
| --- | --- | --- |
| M0 | Landing page, Guides (knowledge base), Help now, installable offline PWA | Not started |
| M1 | The child on this phone: profile, medicines and reminders, quick log, Today, brief in show mode or as a PDF, backup | Not started |
| M2 | Visits and changes: visit prep, visit report PDF, change reviews, welcome back, patterns, label check | Not started |
| M3 | Desktop and passport: wide layouts, install on computers, hospital passport | Not started |
| Later | Not planned (needs a server): parent tips, sync between phones, Ask Dayline, wearables | — |

## What's here

```
CLAUDE.md                     Instructions Claude Code reads first
docs/MILESTONES.md            Tasks and acceptance criteria per milestone
docs/PRODUCT.md               Users, principles, features, voice
docs/DESIGN.md                Figma node map for every screen and component
docs/ARCHITECTURE.md          Stack, routes, offline, show mode, PDF sharing
docs/DATA_MODEL.md            Entities, local storage, backup format
docs/RESEARCH.md              Research and concept doc (exported copy)
design/tokens.json|css        Colours and type from the Figma variables
content/guides/               Guide template, backlog and drafts (need review)
content/calendar.json         Bangladesh seasonal routine changes
setup/github/                 Deploy workflow; Claude Code moves it to .github/ (M0-01)
```

## Links

- Design: [SEVA Design in Figma](https://www.figma.com/design/hWA0tZUaRY535kNq6NZu09/SEVA-Design?node-id=2519-4106). See the pages "v2 · Dayline — Screens", "Landing page" and "Foundations".
- Concept and research: [Claude doc](https://claude.ai/artifact/2SMw5RhDr2nWtZnbJ1E1jJ) (living version of `docs/RESEARCH.md`).

## Getting started with Claude Code

1. Connect the Figma MCP server in Claude Code so it can pull screens by node ID, and sign in to GitHub (`gh auth login`).
2. Open this folder in Claude Code and say:

   > Read CLAUDE.md and docs/MILESTONES.md, then build and deploy M0 to M3 in order on GitHub Pages, committing straight to main.

3. Claude Code sets up the repo and GitHub Pages itself (M0-01). Each milestone goes live when it's done; open the site on your phone and install it.

## Before you launch

- Get every guide reviewed by a named clinician or trained parent (`status: reviewed`). Until then guides show a draft banner; turn off `PUBLISH_DRAFT_GUIDES` if you'd rather hide them.
- Confirm the Islamic holiday dates in `content/calendar.json` each year.
- Data lives only on each phone. Tell families to use the monthly backup; a cleared browser or lost phone without one loses the record.
- Other apps already use the name "Dayline". Use a qualifier in stores, e.g. "Dayline: Autism Care Log", and check trademarks before buying a domain.
