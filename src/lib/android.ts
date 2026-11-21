import type { Lang } from './paths';

/** The Android release on this site: public/android/latest.json, copied from the GitHub Release at deploy. */
export interface Latest {
  version: string;
  versionCode: number;
  date: string;
  file: string;
  bytes: number;
  sha256: string;
  cert_sha256: string;
  minSdk: number;
  internet: boolean;
  notes: { en: string; bn: string };
}

const VERSION = /^\d+\.\d+\.\d+$/;
const locale = (lang: Lang) => (lang === 'bn' ? 'bn-BD' : 'en-GB');

let cached: Promise<Latest | null> | undefined;

/** Build time only. Null when there is no release yet, and always in the native build. */
export function getLatest(): Promise<Latest | null> {
  if (import.meta.env.PUBLIC_NATIVE) return Promise.resolve(null);
  return (cached ??= readLatest());
}

async function readLatest(): Promise<Latest | null> {
  const { access, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'public', 'android');
  try {
    const latest = JSON.parse(await readFile(join(dir, 'latest.json'), 'utf8')) as Latest;
    if (!VERSION.test(latest.version) || !/^dayline-[\w.-]+\.apk$/.test(latest.file) || !(latest.bytes > 0)) {
      throw new Error('public/android/latest.json is not a valid release');
    }
    await access(join(dir, latest.file)); // never link to an APK that isn't on the site
    return latest;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** Negative when a is older than b, positive when newer, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (x[i] ?? 0) - (y[i] ?? 0);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

/** What the update banner shows for ?have=X.Y.Z. Null (no banner) when it is missing or malformed. */
export function updateState(have: string | null, latest: string): 'update' | 'current' | null {
  if (!have || !VERSION.test(have)) return null;
  return compareVersions(have, latest) < 0 ? 'update' : 'current';
}

/** 9123456 → "9.1 MB", "৯.১ MB" in Bangla. */
export function formatSize(bytes: number, lang: Lang): string {
  const mb = new Intl.NumberFormat(locale(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(bytes / 1_000_000);
  return `${mb} MB`;
}

/** "2026-12-04" → "4 December 2026", in the page language. */
export function formatDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

/** SHA-256 in groups of 4. */
export function formatHash(hex: string): string {
  return (hex.replace(/[^0-9a-f]/gi, '').toLowerCase().match(/.{1,4}/g) ?? []).join(' ');
}

/** Certificate fingerprint as colon hex. */
export function formatFingerprint(hex: string): string {
  return (hex.replace(/[^0-9a-f]/gi, '').toUpperCase().match(/.{1,2}/g) ?? []).join(':');
}
