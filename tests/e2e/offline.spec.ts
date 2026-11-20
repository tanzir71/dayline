import { test, expect } from '@playwright/test';
import { waitForOffline } from './helpers';

test('after one online visit, the site works in airplane mode', async ({ page, context }) => {
  await page.goto('./');
  await waitForOffline(page, '/dayline/guides/haircut-day/');
  await waitForOffline(page, '/dayline/help-now/');

  await context.setOffline(true);

  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every day, on one line.');

  await page.goto('guides/');
  await expect(page.locator('.category-tile')).toHaveCount(6);

  await page.goto('guides/night-waking/');
  await expect(page.locator('.guide__body li').first()).toBeVisible();

  await page.goto('bn/guides/haircut-day/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('চুল কাটার দিন');

  await page.goto('help-now/');
  await expect(page.getByRole('link', { name: /Emergency/ })).toBeVisible();

  // Search works offline too: the index is precached.
  await page.goto('guides/');
  await page.locator('.guide-search[data-ready]').waitFor();
  await page.getByRole('searchbox').fill('haircut');
  await expect(page.locator('.guide-search__results')).toContainText('Haircut day');

  // A page this phone has never saved gets the offline page.
  await page.goto('guides/a-guide-that-does-not-exist/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("You're offline");
});

test('the browser considers Dayline installable', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Installability check uses the Chromium DevTools protocol');
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  // Test browsers run in an incognito-like profile; every other installability error fails the test.
  expect(installabilityErrors.filter((e) => e.errorId !== 'in-incognito')).toEqual([]);
  const manifest = await (await page.request.get('manifest.webmanifest')).json();
  // The e2e build runs with the app on: an installed Dayline opens Today, long-press offers three shortcuts.
  expect(manifest.start_url).toBe('/dayline/app/');
  expect(manifest.scope).toBe('/dayline/');
  expect(manifest.theme_color).toBe('#1A5F5A');
  expect(manifest.background_color).toBe('#F3F6F5');
  expect(manifest.shortcuts.slice(0, 3).map((s: { name: string }) => s.name)).toEqual(['Help now', 'Dose given', 'Log a moment']);
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
});
