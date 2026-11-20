/**
 * When the install sheet may show itself (M0-11):
 * first visit on a phone; after "Not now", once more after 7 days; then only from the "Install app" links.
 * Never when installed, on desktop, or during Help now.
 */
export interface InstallState {
  dismissals: number;
  lastDismissed: string | null;
  installed: boolean;
}

export const INSTALL_KEY = 'dayline.install';
export const SNOOZE_DAYS = 7;

export const emptyState: InstallState = { dismissals: 0, lastDismissed: null, installed: false };

export function shouldAutoShow(state: InstallState, now: Date): boolean {
  if (state.installed) return false;
  if (state.dismissals === 0) return true;
  if (state.dismissals === 1 && state.lastDismissed) {
    const days = (now.getTime() - new Date(state.lastDismissed).getTime()) / 86_400_000;
    return days >= SNOOZE_DAYS;
  }
  return false;
}

export function dismiss(state: InstallState, now: Date): InstallState {
  return { ...state, dismissals: state.dismissals + 1, lastDismissed: now.toISOString() };
}

export type Platform = 'android' | 'ios' | 'manual' | 'none';

export interface Env {
  userAgent: string;
  platform?: string;
  maxTouchPoints: number;
  standalone: boolean;
  coarsePointer: boolean;
}

/** Which kind of sheet this device gets ('none' on desktop and when already installed). */
export function detectPlatform(env: Env): Platform {
  if (env.standalone) return 'none';
  const ua = env.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
  if (ios) return 'ios';
  const android = /Android/.test(ua);
  if (android) return /Firefox/.test(ua) ? 'manual' : 'android';
  if (/Mobi/.test(ua) && env.coarsePointer) return 'manual';
  return 'none';
}

export function readState(): InstallState {
  try {
    const raw = localStorage.getItem(INSTALL_KEY);
    return raw ? { ...emptyState, ...(JSON.parse(raw) as Partial<InstallState>) } : emptyState;
  } catch {
    return emptyState;
  }
}

export function writeState(state: InstallState): void {
  try {
    localStorage.setItem(INSTALL_KEY, JSON.stringify(state));
  } catch {
    /* private mode: the sheet may show again next visit */
  }
}
