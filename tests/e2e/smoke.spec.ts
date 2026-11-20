import { test, expect } from '@playwright/test';
import { mockInstallPrompt } from './helpers';

test.describe('landing', () => {
  test('English landing with OG tags for WhatsApp', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every day, on one line.');
    const og = (p: string) => page.locator(`meta[property="og:${p}"]`).getAttribute('content');
    expect(await og('title')).toContain('Dayline');
    expect(await og('description')).toBeTruthy();
    expect(await og('image')).toMatch(/^https?:\/\/.+\/og\/dayline\.png$/);
  });

  test('Bangla landing', async ({ page }) => {
    await page.goto('bn/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('প্রতিটি দিন, এক লাইনে।');
  });
});

test.describe('guides', () => {
  test('a guide shows its draft banner and steps', async ({ page }) => {
    await page.goto('guides/haircut-day/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Haircut day');
    await expect(page.getByRole('note')).toContainText('Draft — not yet reviewed by a clinician');
    await expect(page.locator('.guide__body li').first()).toBeVisible();
    const og = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(og).toContain('haircut');
  });

  test('medicine drafts are never published', async ({ page }) => {
    const res = await page.goto('guides/medicine-times-ramadan/');
    expect(res?.status()).toBe(404);
  });

  test('search finds a guide by an English word', async ({ page }) => {
    await page.goto('guides/');
    await page.locator('.guide-search[data-ready]').waitFor();
    await page.getByRole('searchbox').fill('haircut');
    await expect(page.locator('.guide-search__results')).toContainText('Haircut day');
  });

  test('search finds a guide by a Bangla word', async ({ page }) => {
    await page.goto('bn/guides/');
    await page.locator('.guide-search[data-ready]').waitFor();
    await page.getByRole('searchbox').fill('চুল');
    await expect(page.locator('.guide-search__results')).toContainText('চুল কাটার দিন');
  });

  test('every browse category has a page', async ({ page }) => {
    await page.goto('guides/');
    const tiles = page.locator('.category-tile');
    await expect(tiles).toHaveCount(6);
    await tiles.first().click();
    await expect(page.locator('.guide-row').first()).toBeVisible();
  });
});

test.describe('language', () => {
  test('switching keeps you on the same page and is remembered', async ({ page }) => {
    await page.goto('guides/haircut-day/');
    await page.locator('.site-header .lang-switch').click();
    await expect(page).toHaveURL(/\/dayline\/bn\/guides\/haircut-day\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    // A fresh visit from outside the site opens the remembered language.
    await page.goto('about:blank');
    await page.goto('privacy/');
    await expect(page).toHaveURL(/\/dayline\/bn\/privacy\/$/);
  });

  test('every page has a Bangla and an English version', async ({ page }) => {
    for (const path of ['', 'guides/', 'guides/haircut-day/', 'help-now/', 'privacy/', 'app/', 'guides/category/sleep/']) {
      await page.goto(path);
      const alt = await page.locator('link[rel="alternate"][hreflang="bn"]').getAttribute('href');
      expect(alt, path).toBeTruthy();
      const res = await page.request.get(new URL(alt!).pathname);
      expect(res.status(), alt!).toBe(200);
    }
  });
});

test.describe('help now', () => {
  test('calls 999 by default and the number can be changed', async ({ page }) => {
    await page.goto('help-now/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Fewer words, more space.');
    const call = page.getByRole('link', { name: /Emergency 999/ });
    await expect(call).toHaveAttribute('href', 'tel:999');
    await page.locator('[data-change-number]').click();
    await page.getByLabel('Emergency number to call').fill('112');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('link', { name: /Emergency 112/ })).toHaveAttribute('href', 'tel:112');
    await page.reload();
    await expect(page.getByRole('link', { name: /Emergency 112/ })).toBeVisible();
  });

  test('never shows the install sheet', async ({ page }) => {
    await page.goto('help-now/');
    await mockInstallPrompt(page);
    await page.waitForTimeout(3500);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test.describe('install sheet (Android)', () => {
  test('asks on the first visit; Install calls the browser prompt', async ({ page }) => {
    await page.goto('./');
    await mockInstallPrompt(page);
    const sheet = page.getByRole('dialog', { name: 'Install Dayline' });
    await expect(sheet).toBeVisible({ timeout: 6000 });
    await expect(sheet).toContainText('Works offline, opens in one tap.');
    await sheet.getByRole('button', { name: 'Install' }).click();
    await expect(sheet).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __promptCalled: boolean }).__promptCalled)).toBe(true);
  });

  test('Not now hides it for 7 days, then once more, then only from the menu', async ({ page }) => {
    await page.goto('./');
    await mockInstallPrompt(page);
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 6000 });
    await sheet.getByRole('button', { name: 'Not now' }).click();
    await expect(sheet).toBeHidden();

    await page.reload();
    await mockInstallPrompt(page);
    await page.waitForTimeout(3500);
    await expect(sheet).toHaveCount(0);

    // Eight days later it asks once more.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('dayline.install')!);
      s.lastDismissed = new Date(Date.now() - 8 * 86_400_000).toISOString();
      localStorage.setItem('dayline.install', JSON.stringify(s));
    });
    await page.reload();
    await mockInstallPrompt(page);
    await expect(sheet).toBeVisible({ timeout: 6000 });
    await sheet.getByRole('button', { name: 'Not now' }).click();

    // After that, only the Install app link opens it.
    await page.reload();
    await mockInstallPrompt(page);
    await page.waitForTimeout(3500);
    await expect(sheet).toHaveCount(0);
    await page.locator('.site-menu__toggle').click();
    await page.locator('.site-menu').getByRole('button', { name: 'Install app' }).click();
    await expect(sheet).toBeVisible();
  });

  test('is in Bangla on Bangla pages', async ({ page }) => {
    await page.goto('bn/');
    await mockInstallPrompt(page);
    await expect(page.getByRole('dialog', { name: 'ডেলাইন ইনস্টল করুন' })).toBeVisible({ timeout: 6000 });
  });
});

test.describe('install sheet (iPhone)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' });

  test('shows the Add to Home Screen steps', async ({ page }) => {
    await page.goto('./');
    const sheet = page.getByRole('dialog', { name: 'Add Dayline to your Home Screen' });
    await expect(sheet).toBeVisible({ timeout: 6000 });
    await expect(sheet).toContainText('Tap Share');
    await expect(sheet).toContainText('Add to Home Screen');
  });
});

test.describe('install sheet (desktop)', () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' });

  test('never shows on desktop', async ({ page }) => {
    await page.goto('./');
    await mockInstallPrompt(page);
    await page.waitForTimeout(3500);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test('no request ever leaves the site', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const outside: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (['http:', 'https:'].includes(u.protocol) && u.origin !== origin) outside.push(r.url());
  });
  for (const path of ['', 'bn/', 'guides/', 'guides/haircut-day/', 'bn/guides/', 'help-now/', 'privacy/', 'app/', 'bn/app/', 'app/#/help-now']) {
    await page.goto(path, { waitUntil: 'networkidle' });
  }
  await page.goto('guides/');
  await page.locator('.guide-search[data-ready]').waitFor();
  await page.getByRole('searchbox').fill('sleep');
  await expect(page.locator('.guide-search__results')).toBeVisible();
  expect(outside).toEqual([]);
});
