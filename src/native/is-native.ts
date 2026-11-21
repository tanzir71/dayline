/** True only in the Android build. The web build drops everything behind this flag. */
export const NATIVE_BUILD = import.meta.env.PUBLIC_NATIVE === '1';

/** A notification button pressed before the app screen was ready. */
export const PENDING_ACTION = 'dayline.pendingReminderAction';

export function isNative(): boolean {
  if (!NATIVE_BUILD || typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}
