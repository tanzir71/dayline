import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { historyBackup, restore } from './fixtures';
import { mockInstallPrompt } from './helpers';

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0';
const noShare = () => Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
const pages = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} not visible`);
  return b;
}

test.describe('desktop at 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, userAgent: DESKTOP_UA });

  test('Today has two panes and the nav is a left rail', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('b.json'));
    await page.goto('app/#/today');
    await expect(page.locator('.day-card')).toBeVisible();
    const day = await box(page, '.day-card');
    const quick = await box(page, '.quick-bar');
    const rail = await box(page, '.nav-bar');
    expect(rail.width).toBeLessThan(120);
    expect(rail.height).toBeGreaterThan(600);
    expect(day.x).toBeGreaterThan(rail.width);
    expect(quick.y).toBeLessThan(day.y);
    const side = await box(page, '.today-layout > .week-card');
    expect(side.x).toBeGreaterThan(day.x + day.width - 1);
    const main = await box(page, '.today-layout');
    expect(main.width).toBeGreaterThan(900);
  });

  test('Insights uses the full width', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('b.json'));
    await page.goto('app/#/insights');
    await expect(page.locator('.pattern').first()).toBeVisible();
    const xs = new Set<number>();
    for (const el of await page.locator('.insights-layout > section').all()) xs.add(Math.round((await el.boundingBox())!.x));
    expect(xs.size).toBeGreaterThanOrEqual(3);
  });

  test('the visit report is a full-width page with a side column', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('b.json'));
    await page.goto('app/#/visit/v1/report');
    const side = await box(page, '.report__side');
    const main = await box(page, '.report__main');
    expect(main.x).toBeGreaterThan(side.x + side.width);
    expect(main.width).toBeGreaterThan(700);
  });

  test('no screen is a stretched phone layout', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('b.json'));
    for (const path of ['app/#/today', 'app/#/insights', 'app/#/child', 'app/#/settings', 'guides/', 'guides/haircut-day/']) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, path).toBe(false);
      if (path.startsWith('app/')) {
        // The phone's bottom tab bar becomes a left rail; the quick-log bar sits in the page, not pinned.
        if (await page.locator('.nav-bar').count()) expect((await box(page, '.nav-bar')).width, path).toBeLessThan(120);
        if (path.endsWith('today')) expect(await page.locator('.quick-bar').evaluate((e) => getComputedStyle(e).position)).toBe('static');
      }
    }
  });

  test('Install app is a header button on desktop, never the bottom sheet', async ({ page }) => {
    await page.goto('./');
    await mockInstallPrompt(page);
    const button = page.locator('.site-header').getByRole('button', { name: 'Install app' });
    await expect(button).toBeVisible();
    await button.click();
    expect(await page.evaluate(() => (window as unknown as { __promptCalled: boolean }).__promptCalled)).toBe(true);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(button).toBeHidden();
  });

  test('keyboard: N logs a moment, D a dose, Esc closes, / searches guides', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('b.json'));
    await page.goto('app/#/today');
    await page.locator('.day-card').waitFor();
    await page.keyboard.press('n');
    const sheet = page.getByRole('dialog', { name: 'Log a moment' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('radio', { name: 'Hard moment' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await page.keyboard.press('d');
    await expect(sheet.getByRole('radio', { name: 'Dose' })).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await page.keyboard.press('/');
    await expect(page).toHaveURL(/guides\/\?focus=search$/);
    await expect(page.getByRole('searchbox')).toBeFocused();
  });
});

test.describe('hospital passport', () => {
  test('fits one A4 page in Bangla and in English, and is shared from the phone', async ({ page }) => {
    await page.addInitScript(noShare);
    await page.goto('app/');
    await page.getByLabel("Your child's name").fill('রাফি');
    await page.getByRole('radio', { name: 'বাংলা' }).click();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    const sections: [string, string][] = [
      ['communication', 'ছোট বাক্য, ছবির কার্ড\nহাত ধরে নিয়ে যায়'],
      ['distress_signs', 'চুপ হয়ে যায়, পেট চেপে ধরে\nকান ঢাকে'],
      ['calms', 'হেডফোন\nচুপচাপ কোণ\nশক্ত করে জড়িয়ে ধরা, যদি সে চায়'],
      ['avoid', 'জোরে আওয়াজ\nভিড়'],
      ['food', 'কোনো জানা অ্যালার্জি নেই\nভাত, ডিম, কলা খায়'],
    ];
    for (const [key, body] of sections) {
      await page.goto(`app/#/child/section/${key}`);
      await page.locator('#sec-body').fill(body);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(/#\/child$/);
    }
    for (const lang of ['বাংলা', 'English']) {
      await page.goto('app/#/child?sheet=passport');
      await page.getByRole('radio', { name: lang }).click();
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: /Send as PDF/ }).click();
      const download = await downloading;
      expect(download.suggestedFilename()).toMatch(/hospital-passport-\d{4}-\d{2}-\d{2}\.pdf$/);
      const pdf = await readFile((await download.path())!);
      expect(pages(pdf), lang).toBe(1);
      if (lang === 'বাংলা') await download.saveAs('test-results/passport-bn.pdf');
    }
    // Show mode for the passport stays put until Done is held.
    await page.goto('app/#/passport/bn');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('রাফি');
    await page.evaluate(() => (location.hash = '#/today'));
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/#\/passport\/bn$/);
  });
});

test.describe('print on A4 and Letter', () => {
  for (const format of ['A4', 'Letter'] as const) {
    test(`brief and passport print on one ${format} page, the visit report on two`, async ({ page }, info) => {
      await page.addInitScript(() => (window.print = () => undefined));
      await restore(page, historyBackup(), info.outputPath('b.json'));
      const printed = async (open: string) => {
        await page.goto(open);
        await page.getByRole('button', { name: /Print or save/ }).click();
        await page.locator('#print-root .pdf-page').first().waitFor({ state: 'attached' });
        return pages(await page.pdf({ format, printBackground: true }));
      };
      expect(await printed('app/#/today?sheet=share')).toBe(1);
      expect(await printed('app/#/child?sheet=passport')).toBe(1);
      await page.goto('app/#/visit/v1/report');
      await page.getByRole('button', { name: 'Share the report' }).click();
      await page.getByRole('button', { name: /Print or save/ }).click();
      await page.locator('#print-root .pdf-page').first().waitFor({ state: 'attached' });
      expect(pages(await page.pdf({ format, printBackground: true }))).toBe(2);
    });
  }
});

test('a backup made on a phone imports on a computer with everything intact', async ({ browser }, info) => {
  const phone = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, baseURL: test.info().project.use.baseURL });
  const p = await phone.newPage();
  await p.addInitScript(noShare);
  await restore(p, historyBackup(), info.outputPath('seed.json'));
  await p.goto('app/#/settings');
  const downloading = p.waitForEvent('download');
  await p.getByRole('button', { name: 'Save a backup file' }).click();
  const file = info.outputPath('from-phone.json');
  await (await downloading).saveAs(file);
  await phone.close();

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, isMobile: false, userAgent: DESKTOP_UA, baseURL: test.info().project.use.baseURL });
  const d = await desk.newPage();
  const messages: string[] = [];
  d.on('dialog', (dlg) => {
    messages.push(dlg.message());
    void dlg.accept();
  });
  await d.goto('app/#/settings');
  await d.locator('input[type=file]').setInputFiles(file);
  await expect(d.getByText('Restored from the backup')).toBeVisible();
  expect(messages[0]).toContain('This replaces everything on this device');
  await d.waitForTimeout(800);
  await d.goto('app/#/insights');
  await expect(d.locator('.pattern').first()).toBeVisible();
  await d.goto('app/#/child/medicines');
  await expect(d.getByText('Risperidone')).toBeVisible();
  const original = JSON.parse(await readFile(file, 'utf8'));
  await d.goto('app/#/settings');
  const again = d.waitForEvent('download');
  await d.getByRole('button', { name: 'Save a backup file' }).click();
  const copy = JSON.parse(await readFile((await (await again).path())!, 'utf8'));
  for (const table of Object.keys(original.tables)) {
    if (table === 'settings' || table === 'share_record') continue;
    expect(copy.tables[table].length, table).toBe(original.tables[table].length);
  }
  await desk.close();
});
