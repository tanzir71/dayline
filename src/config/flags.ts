import released from './released.json';

/**
 * Feature flags. Every push to main deploys, so anything unfinished stays off here.
 * Turn a milestone's flags on only when its acceptance criteria pass.
 * Released milestones are listed in released.json (also read by astro.config.mjs for the manifest).
 * PUBLIC_FLAGS=APP,PLAYBOOK turns flags on for a build (the e2e tests use this).
 */
const forced = new Set(
  String(import.meta.env?.PUBLIC_FLAGS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
const on = (name: keyof typeof released) => released[name] || forced.has(name);

export const flags = {
  /** Publish `status: draft` guides with a visible draft banner (medicine drafts are never published). */
  PUBLISH_DRAFT_GUIDES: true,
  /** M1: the app at /app/ (Today, quick log, profile, medicines, show mode, PDF, backup). */
  APP: on('APP'),
  /** M1: "Save to playbook" on guide pages. */
  PLAYBOOK: on('PLAYBOOK'),
  /** M2: Insights, visits, changes, patterns, label check. */
  INSIGHTS: on('INSIGHTS'),
  /** M3: wide layouts, desktop install button, hospital passport. */
  DESKTOP: on('DESKTOP'),
} as const;

export type Flag = keyof typeof flags;
