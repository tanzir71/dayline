import { describe, it, expect } from 'vitest';
import { shouldAutoShow, dismiss, detectPlatform, emptyState } from './install-state';

const day = 86_400_000;

describe('install sheet rules', () => {
  const t0 = new Date('2026-11-20T10:00:00Z');
  it('shows on the first visit', () => {
    expect(shouldAutoShow(emptyState, t0)).toBe(true);
  });
  it('after Not now, waits 7 days, then shows once more', () => {
    const once = dismiss(emptyState, t0);
    expect(shouldAutoShow(once, new Date(t0.getTime() + 6 * day))).toBe(false);
    expect(shouldAutoShow(once, new Date(t0.getTime() + 7 * day))).toBe(true);
  });
  it('after the second Not now, never shows by itself', () => {
    const twice = dismiss(dismiss(emptyState, t0), new Date(t0.getTime() + 8 * day));
    expect(shouldAutoShow(twice, new Date(t0.getTime() + 400 * day))).toBe(false);
  });
  it('never shows once installed', () => {
    expect(shouldAutoShow({ ...emptyState, installed: true }, t0)).toBe(false);
  });
});

describe('platform detection', () => {
  const base = { maxTouchPoints: 5, standalone: false, coarsePointer: true };
  it('Android Chrome gets the Install button', () => {
    expect(detectPlatform({ ...base, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile Safari/537.36' })).toBe('android');
  });
  it('iPhone gets the Add to Home Screen steps', () => {
    expect(detectPlatform({ ...base, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1' })).toBe('ios');
  });
  it('desktop gets nothing', () => {
    expect(detectPlatform({ maxTouchPoints: 0, standalone: false, coarsePointer: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36' })).toBe('none');
  });
  it('installed app gets nothing', () => {
    expect(detectPlatform({ ...base, standalone: true, userAgent: 'Android Chrome' })).toBe('none');
  });
});
