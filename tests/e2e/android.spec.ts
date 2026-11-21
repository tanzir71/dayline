import { test, expect } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mockInstallPrompt } from './helpers';

// The main e2e build has no release, so it covers "coming soon". The release cases get their own
// build, with a fixture in public/android/ that is removed as soon as that build ends.
const ROOT = process.cwd();
const PUBLIC_ANDROID = join(ROOT, 'public', 'android');
const OUT = join(ROOT, '.astro', 'android-e2e');
const PORT = 4331;
const BASE = '/dayline/';
const LATEST = {
  version: '1.0.0',
  versionCode: 10000,
  date: '2026-12-04',
  file: 'dayline-1.0.0.apk',
  bytes: 9123456,
  sha256: '9f2c41ab77e00d3a5b19c6e28a40f1d73e95b0c826fa1d44e7b359a0c8126e3f',
  cert_sha256: '7b2c901e4da83f660bd157c4e2198af03d6ea2b5417c09e85fd322ab6814c790',
  minSdk: 26,
  internet: false,
  notes: { en: 'First release', bn: 'প্রথম রিলিজ' },
};

test.describe('without a release', () => {
  test('no band, and /android/ says coming soon', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.android-band')).toHaveCount(0);
    await page.goto('android/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dayline for Android');
    await expect(page.getByText('The Android app is coming soon.')).toBeVisible();
    await expect(page.locator('a[download]')).toHaveCount(0);
    await expect(page.getByRole('main').getByRole('link', { name: 'Open the app' })).toBeVisible();
  });

  test('the sheet keeps the single install option', async ({ page }) => {
    await page.goto('./');
    await mockInstallPrompt(page);
    const sheet = page.getByRole('dialog', { name: 'Install Dayline' });
    await expect(sheet).toBeVisible({ timeout: 6000 });
    await expect(sheet.locator('a[download]')).toHaveCount(0);
  });
});

test.describe('with a release', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ baseURL: `http://localhost:${PORT}${BASE}` });

  let server: ChildProcess | undefined;

  test.beforeAll(async () => {
    test.setTimeout(420_000);
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(PUBLIC_ANDROID, { recursive: true });
    try {
      writeFileSync(join(PUBLIC_ANDROID, 'latest.json'), JSON.stringify(LATEST));
      writeFileSync(join(PUBLIC_ANDROID, LATEST.file), 'not a real apk');
      execSync(`npx astro build --outDir ${JSON.stringify(join(OUT, 'dist'))}`, {
        cwd: ROOT,
        stdio: 'pipe',
        env: { ...process.env, PUBLIC_BASE_PATH: BASE, PUBLIC_SITE_URL: `http://localhost:${PORT}`, PUBLIC_FLAGS: 'APP,PLAYBOOK,INSIGHTS,DESKTOP' },
      });
    } finally {
      rmSync(PUBLIC_ANDROID, { recursive: true, force: true });
    }
    server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs'), '--port', String(PORT), '--base', BASE], { cwd: OUT, stdio: 'ignore' });
    await expect
      .poll(() => fetch(`http://localhost:${PORT}${BASE}`).then((r) => r.status, () => 0), { timeout: 15_000 })
      .toBe(200);
  });

  test.afterAll(async () => {
    if (server) {
      const exited = new Promise((resolve) => server!.once('exit', resolve));
      server.kill();
      await exited;
    }
    rmSync(OUT, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  test('the band shows and its download is same-origin', async ({ page, baseURL }) => {
    await page.goto('./');
    const band = page.locator('.android-band');
    await expect(band.getByRole('heading', { name: 'Say it. It goes on the line.' })).toBeVisible();
    await expect(band).toContainText('Version 1.0.0 · 9.1 MB · Android 8 or newer · free');
    const link = band.getByRole('link', { name: 'Download for Android' });
    await expect(link).toHaveAttribute('download', '');
    const url = new URL((await link.getAttribute('href'))!, page.url());
    expect(url.origin).toBe(new URL(baseURL!).origin);
    expect(url.pathname).toBe(`${BASE}android/dayline-1.0.0.apk`);
    expect((await page.request.get(url.href)).status()).toBe(200);
    await expect(band.getByRole('link', { name: 'How to install' })).toHaveAttribute('href', `${BASE}android/`);
    const phone = band.locator('.android-band__phone');
    await phone.scrollIntoViewIfNeeded();
    await expect.poll(() => phone.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBe(552);
  });

  test('Bangla page uses Bangla digits for the size', async ({ page }) => {
    await page.goto('bn/');
    await expect(page.locator('.android-band')).toContainText('৯.১ MB');
  });

  test('?have=0.9.0 shows the update banner', async ({ page }) => {
    await page.goto('android/?have=0.9.0');
    const banner = page.locator('[data-update="update"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('1.0.0 is here. You have 0.9.0.');
    await expect(page.locator('[data-update="current"]')).toBeHidden();
  });

  test('?have=1.0.0 says it is the latest', async ({ page }) => {
    await page.goto('android/?have=1.0.0');
    await expect(page.locator('[data-update="current"]')).toContainText('You have the latest version.');
    await expect(page.locator('[data-update="update"]')).toBeHidden();
  });

  test('no banner without a valid ?have', async ({ page }) => {
    for (const q of ['', '?have=%3Cimg%20src%3Dx%3E']) {
      await page.goto(`android/${q}`);
      await expect(page.locator('.android-update:visible')).toHaveCount(0);
    }
  });

  test('the install page shows steps, the no-internet line and the checks', async ({ page }) => {
    await page.goto('android/');
    await expect(page.locator('.android-steps > li')).toHaveCount(3);
    await expect(page.locator('.android-dialog')).toHaveCount(2);
    await expect(page.getByText('The app has no internet permission')).toBeVisible();
    await expect(page.locator('.android-hash').first()).toHaveText(/^9f2c 41ab 77e0 /);
    await expect(page.locator('.android-hash').last()).toHaveText(/^7B:2C:90:1E:/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('the Android sheet offers the app and the home screen', async ({ page }) => {
    await page.goto('./');
    await mockInstallPrompt(page);
    const sheet = page.getByRole('dialog', { name: 'Keep Dayline on this phone' });
    await expect(sheet).toBeVisible({ timeout: 6000 });
    await expect(sheet).toContainText('One download, 9.1 MB.');
    await expect(sheet.getByRole('link', { name: 'Download' })).toHaveAttribute('href', `${BASE}android/dayline-1.0.0.apk`);
    await expect(sheet.getByRole('link', { name: 'How to install' })).toHaveAttribute('href', `${BASE}android/`);
    await sheet.getByRole('button', { name: 'Install' }).click();
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __promptCalled: boolean }).__promptCalled)).toBe(true);
  });

  test('the sheet never opens by itself on the install page', async ({ page }) => {
    await page.goto('android/');
    await mockInstallPrompt(page);
    await page.waitForTimeout(3500);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the APK download does not go through the service worker cache', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const download = page.waitForEvent('download');
    await page.locator('.android-band').getByRole('link', { name: 'Download for Android' }).click();
    expect((await download).suggestedFilename()).toBe('dayline-1.0.0.apk');
    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) urls.push(r.url);
      return urls.filter((u) => u.endsWith('.apk'));
    });
    expect(cached).toEqual([]);
  });
});
