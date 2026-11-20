/**
 * Feature flags. Every push to main deploys, so anything unfinished stays off here.
 * Turn a milestone's flags on only when its acceptance criteria pass.
 */
export const flags = {
  /** Publish `status: draft` guides with a visible draft banner (medicine drafts are never published). */
  PUBLISH_DRAFT_GUIDES: true,
  /** M1: the app at /app/ (Today, quick log, profile, medicines, show mode, PDF, backup). */
  APP: false,
  /** M1: "Save to playbook" on guide pages. */
  PLAYBOOK: false,
  /** M2: Insights, visits, changes, patterns, label check. */
  INSIGHTS: false,
  /** M3: wide layouts, desktop install button, hospital passport. */
  DESKTOP: false,
} as const;

export type Flag = keyof typeof flags;
