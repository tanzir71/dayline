import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { waitForOffline } from './helpers';

async function onboard(page: Page, name = 'Rafi', opts: { me?: string; bangla?: boolean } = {}) {
  await page.goto('app/');
  await page.getByLabel("Your child's name").fill(name);
  if (opts.bangla) await page.getByRole('radio', { name: 'বাংলা' }).click();
  if (opts.me) await page.getByLabel('Your name, or what your child calls you').fill(opts.me);
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
}

async function addMedicine(page: Page, name: string, time: string, opts: { left?: string } = {}) {
  await page.goto('app/#/child/medicines/new');
  await page.getByLabel('Medicine name').fill(name);
  await page.getByLabel('Times 1').fill(time);
  await page.getByLabel('Amount each time').fill('1 tablet');
  if (opts.left) await page.getByLabel('Tablets or doses left').fill(opts.left);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/#\/child\/medicines$/);
}

const pastTime = () => {
  const d = new Date(Date.now() - 10 * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

test.describe('app', () => {
  test('a new parent reaches a useful Today without logging anything', async ({ page }) => {
    const start = Date.now();
    await onboard(page, 'Rafi', { me: 'Amma' });
    expect(Date.now() - start).toBeLessThan(120_000);
    await expect(page.getByRole('link', { name: /Help now/ }).first()).toBeVisible();
    await expect(page.getByText("Rafi's day")).toBeVisible();
    await expect(page.getByText(/Nothing logged yet|No medicines added/)).toBeVisible();
    await expect(page.getByText('For Rafi this week')).toBeVisible();
    await expect(page.locator('.nav-bar')).toContainText('Rafi');
  });

  test('marking a dose puts it on the day line and counts down the refill', async ({ page }) => {
    await onboard(page, 'Rafi', { me: 'Amma' });
    await addMedicine(page, 'Melatonin', pastTime(), { left: '5' });
    await page.goto('app/#/today');
    await expect(page.getByText('Melatonin: about 5 days left')).toBeVisible();
    await page.getByRole('button', { name: 'Mark given' }).click();
    await expect(page.locator('.timeline')).toContainText('Melatonin given');
    await expect(page.locator('.timeline')).toContainText('By Amma');
    await expect(page.getByText('Melatonin: about 4 days left')).toBeVisible();
  });

  test('quick log saves a hard moment with what came before', async ({ page }) => {
    await onboard(page);
    await page.locator('.quick-bar').getByRole('link', { name: 'Hard moment' }).click();
    const sheet = page.getByRole('dialog', { name: 'Log a moment' });
    await sheet.getByRole('radio', { name: '3', exact: true }).click();
    await sheet.getByRole('radio', { name: '5–15 min' }).click();
    await sheet.getByRole('button', { name: 'Transition' }).click();
    await sheet.getByRole('button', { name: 'Save to today' }).click();
    await expect(page.locator('.timeline')).toContainText('Hard moment · 10 min');
    await expect(page.locator('.timeline')).toContainText('Before: Transition');
  });

  test('Help now shows the playbook and saving it puts the moment on the day line', async ({ page }) => {
    await onboard(page);
    await page.goto('app/#/playbook/add/help-now');
    await page.getByRole('button', { name: "Save to Rafi's playbook" }).click();
    await expect(page).toHaveURL(/#\/playbook$/);
    await page.goto('app/#/help-now');
    await expect(page.getByRole('heading', { name: 'What works for Rafi' })).toBeVisible();
    await page.locator('.play').filter({ hasText: 'Fewer words' }).getByRole('button', { name: 'Helped' }).click();
    await page.getByRole('button', { name: "It's over, save it" }).click();
    await expect(page).toHaveURL(/#\/today$/);
    await expect(page.locator('.timeline')).toContainText('Hard moment');
    await expect(page.locator('.timeline')).toContainText('Helped: Fewer words, softer voice');
    await expect(page.locator('.timeline')).toContainText('From Help now');
  });

  test('show mode reaches no other screen; Mark given logs; Done needs a hold', async ({ page }) => {
    await onboard(page, 'Rafi', { me: 'Amma' });
    await addMedicine(page, 'Melatonin', pastTime());
    await page.goto('app/#/today?sheet=share');
    await page.getByRole('button', { name: /Show on this phone/ }).click();
    await expect(page).toHaveURL(/#\/show\/en$/);
    await expect(page.locator('.nav-bar')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Rafi, from');

    await page.evaluate(() => (location.hash = '#/child'));
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/#\/show\/en$/);
    await page.goBack();
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/#\/show\/en$/);

    await page.getByRole('button', { name: 'Mark given' }).click();
    await expect(page.getByRole('button', { name: 'Mark given' })).toHaveCount(0);

    const done = page.getByRole('button', { name: 'Done, back to Dayline' });
    await done.click();
    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/#\/show\/en$/);
    const box = (await done.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1300);
    await page.mouse.up();
    await expect(page).toHaveURL(/#\/today$/);
    await expect(page.locator('.timeline')).toContainText('Melatonin given');
  });

  test('the brief PDF is made on the phone, in Bangla', async ({ page }) => {
    // Without file sharing (desktop browsers) the PDF downloads; Android's share sheet is checked below.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    });
    await onboard(page, 'রাফি', { bangla: true });
    await page.goto('app/#/child/section/calms');
    await page.locator('#sec-body').fill('হেডফোন, স্কুলব্যাগের সামনের পকেটে\nচুপচাপ কোণ');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/#\/child$/);
    await page.goto('app/#/today?sheet=share');
    await page.getByRole('radio', { name: 'বাংলা' }).click();
    await expect(page.getByRole('radio', { name: 'বাংলা' })).toHaveAttribute('aria-checked', 'true');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: /Send as PDF/ }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^রাফি-brief-\d{4}-\d{2}-\d{2}\.pdf$/);
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(30_000);
    expect(bytes.length).toBeLessThan(1_500_000);
    expect(await page.evaluate(() => document.fonts.check('16px "Hind Siliguri"', 'হেডফোন'))).toBe(true);
    await download.saveAs('test-results/brief-bn.pdf');
  });

  test('Send as PDF hands the file to the system share sheet when it can (Android → WhatsApp)', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shared: { name: string; type: string; size: number }[] };
      w.__shared = [];
      Object.defineProperty(navigator, 'canShare', { value: (d: { files?: File[] }) => !!d.files?.length, configurable: true });
      Object.defineProperty(navigator, 'share', {
        value: async (d: { files: File[] }) => {
          w.__shared.push(...d.files.map((f) => ({ name: f.name, type: f.type, size: f.size })));
        },
        configurable: true,
      });
    });
    await onboard(page);
    await page.goto('app/#/today?sheet=share');
    await page.getByRole('button', { name: /Send as PDF/ }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shared: unknown[] }).__shared.length), { timeout: 20_000 }).toBe(1);
    const shared = await page.evaluate(() => (window as unknown as { __shared: { name: string; type: string; size: number }[] }).__shared[0]!);
    expect(shared.type).toBe('application/pdf');
    expect(shared.name).toMatch(/^Rafi-brief-/);
  });

  test('the calendar file has repeating events with alarms', async ({ page }) => {
    await onboard(page);
    await addMedicine(page, 'Melatonin', '19:00');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: "Add reminders to the phone's calendar" }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe('dayline-medicines.ics');
    const text = await readFile((await download.path())!, 'utf8');
    expect(text).toContain('BEGIN:VEVENT');
    expect(text).toContain('RRULE:FREQ=DAILY');
    expect(text).toContain('BEGIN:VALARM');
    expect(text).toMatch(/DTSTART;TZID=[^:]+:\d{8}T190000/);
  });

  test('backup: export, delete everything, import restores it', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    });
    await onboard(page, 'Rafi', { me: 'Amma' });
    await page.locator('.quick-bar').getByRole('link', { name: 'Win' }).click();
    await page.getByLabel('What went well?').fill('Asked for water');
    await page.getByRole('button', { name: 'Save to today' }).click();
    await expect(page.locator('.timeline')).toContainText('Win: Asked for water');

    await page.goto('app/#/settings');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save a backup file' }).click();
    const file = await (await downloading).path();
    await expect(page.getByText(/Last backup:/)).toBeVisible();

    await page.getByRole('button', { name: 'Delete everything on this phone' }).click();
    await expect(page.getByLabel("Your child's name")).toBeVisible();

    await page.goto('app/#/settings');
    await page.locator('input[type=file]').setInputFiles(file!);
    await expect(page.getByText('Restored from the backup')).toBeVisible();
    await page.waitForURL(/app\//);
    await page.goto('app/#/today');
    await expect(page.locator('.timeline')).toContainText('Win: Asked for water');
    await expect(page.locator('.child-switch__name')).toHaveText('Rafi');
  });

  test('Today works offline and keeps its data after a reload', async ({ page, context }) => {
    await onboard(page, 'Rafi', { me: 'Amma' });
    await page.locator('.quick-bar').getByRole('link', { name: 'Win' }).click();
    await page.getByRole('button', { name: 'Save to today' }).click();
    await waitForOffline(page, '/dayline/app/');
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.locator('.timeline')).toContainText('Win');
  });

  test('Bangla app', async ({ page }) => {
    await page.goto('bn/app/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'bn');
    await expect(page.getByRole('button', { name: 'শুরু করুন' }).or(page.locator('button[type=submit]'))).toBeVisible();
  });
});
