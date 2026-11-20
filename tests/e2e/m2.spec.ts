import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { historyBackup, restore } from './fixtures';

const noShare = () =>
  Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });

test.describe('visits and changes', () => {
  test('with zero logged days, visit prep still produces a two-page PDF report', async ({ page }) => {
    await page.addInitScript(noShare);
    await page.goto('app/');
    await page.getByLabel("Your child's name").fill('Rafi');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await page.goto('app/#/visits?add=1');
    await page.getByRole('button', { name: '+ Add a doctor or therapist' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Dr. Rahman');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Save the visit' }).click();
    await expect(page.getByRole('heading', { name: 'Prep for the visit' })).toBeVisible();
    await page.getByRole('radio', { name: 'About the same' }).click();
    await page.getByRole('radio', { name: 'Worse' }).click();
    await page.getByRole('button', { name: 'Appetite' }).click();
    await page.getByLabel('Your questions for the doctor 1').fill('Is the morning grogginess a concern?');
    await expect(page.getByText('Uses your answers; nothing needs to be logged')).toBeVisible();
    await page.getByRole('button', { name: 'Make the report' }).click();
    await expect(page.getByRole('heading', { name: 'Since your last visit' })).toBeVisible();
    await expect(page.getByText('Nothing logged in this period. The answers below are from memory.')).toBeVisible();
    await expect(page.getByText('Is the morning grogginess a concern?')).toBeVisible();

    await page.getByRole('button', { name: 'Share the report' }).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: /Send as PDF/ }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/^Rafi-visit-report-\d{4}-\d{2}-\d{2}\.pdf$/);
    const pdf = await readFile((await download.path())!);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
  });

  test('a change review shows before and after counts, days on each side, and flags the overlap', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('backup.json'));
    await page.goto('app/#/insights');
    await page.getByRole('link', { name: /Melatonin moved from 8:30 to 7:00 pm/ }).click();
    await expect(page.getByRole('heading', { name: 'Melatonin moved from 8:30 to 7:00 pm' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '14 days before' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Days with a hard moment/ })).toContainText(/\d+ of 14/);
    await expect(page.getByText(/Based on 14 days before and 14 days after with entries/)).toBeVisible();
    await expect(page.getByText('Another change overlapped')).toBeVisible();
    await expect(page.getByText(/New lunch-to-class routine at school on/)).toBeVisible();
  });

  test('the visit report shows changes from every prescriber and label-matched symptoms as questions', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('backup.json'));
    await page.goto('app/#/visit/v1/report');
    await expect(page.getByRole('heading', { name: 'Since your last visit' })).toBeVisible();
    await expect(page.getByText(/days have entries, from 1 caregiver$/)).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Melatonin moved from 8:30 to 7:00 pm' })).toBeVisible();
    await expect(page.getByText('Other prescriber').first()).toBeVisible();
    await expect(page.getByText('Sleepiness, 2 days')).toBeVisible();
    await expect(page.getByText('Listed on the Risperidone label.')).toBeVisible();
    await expect(page.getByText('Dayline lists these as questions for you. It does not suggest doses or changes.')).toBeVisible();
  });
});

test.describe('patterns', () => {
  test('patterns need 7 days in each group and every pattern opens its raw days', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('backup.json'));
    await page.goto('app/#/insights');
    const card = page.locator('.pattern').filter({ hasText: 'After nights under 7 hours' });
    await expect(card).toBeVisible();
    await expect(card).toContainText(/After short nights: \d+ of 10 days had a hard moment/);
    await expect(card).toContainText(/Other days: \d+ of 30/);
    await card.getByRole('button', { name: 'See days' }).click();
    await expect(card.locator('.raw-days__list li')).toHaveCount(40);
    await card.getByRole('button', { name: 'Makes sense' }).click();
    await expect(card.getByRole('button', { name: 'Makes sense' })).toHaveAttribute('aria-pressed', 'true');
    // Constipation was never noted: no pattern, and nothing pretends otherwise.
    await expect(page.locator('.pattern').filter({ hasText: 'constipation' })).toHaveCount(0);
  });

  test('nothing is shown below the threshold', async ({ page }) => {
    await page.goto('app/');
    await page.getByLabel("Your child's name").fill('Rafi');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await page.goto('app/#/insights');
    await expect(page.getByText(/Patterns appear after a few weeks of taps/)).toBeVisible();
    await expect(page.locator('.pattern')).toHaveCount(0);
  });
});

test.describe('welcome back and labels', () => {
  test('welcome back appears after a 7-day gap and never shows a backlog', async ({ page }, info) => {
    await restore(page, historyBackup({ lastOpenedDaysAgo: 12 }), info.outputPath('backup.json'));
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByText(/No need to fill the gap/)).toBeVisible();
    await expect(page.getByText('A new medicine, or a dose change?')).toBeVisible();
    await expect(page.getByText(/Risperidone was marked given on \d+ of \d+ days/)).toBeVisible();
    await expect(page.locator('input[type=date], .quick-log')).toHaveCount(0);
    await page.getByRole('button', { name: 'Done, show today' }).click();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  });

  test('medicine pages show the label source and date and never suggest doses', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('backup.json'));
    await page.goto('app/#/child/medicines/m1/info');
    await expect(page.getByText('From the official label')).toBeVisible();
    await expect(page.getByText(/Source: U\.S\. FDA drug label via openFDA, label dated .+, checked .+\./)).toBeVisible();
    await expect(page.getByText("Dayline never suggests doses or changes; ask the prescriber.")).toBeVisible();
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const advice of ['increase the dose', 'reduce the dose', 'you should stop', 'you should take']) expect(text).not.toContain(advice);
  });

  test('a visit three days away nudges on Today, and the weekly check-in saves in three taps', async ({ page }, info) => {
    await restore(page, historyBackup(), info.outputPath('backup.json'));
    await page.goto('app/#/today');
    await expect(page.getByText(/Visit with Dr\. Rahman on/)).toBeVisible();
    await page.goto('app/#/settings');
    const today = new Date().getDay();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    await page.getByRole('radio', { name: days[today], exact: true }).click();
    await page.locator('input[type=time]').fill('00:00');
    await page.goto('app/#/today');
    const card = page.locator('.check-in');
    await card.getByRole('radiogroup', { name: 'Sleep' }).getByRole('radio', { name: 'Same' }).click();
    await card.getByRole('radiogroup', { name: 'Mood' }).getByRole('radio', { name: 'Better' }).click();
    await card.getByRole('radiogroup', { name: 'Hard moments' }).getByRole('radio', { name: 'Less' }).click();
    await card.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.check-in')).toHaveCount(0);
    await page.goto('app/#/insights');
    await expect(page.getByText('Weekly check-ins')).toBeVisible();
  });
});
