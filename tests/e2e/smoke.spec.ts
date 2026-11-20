import { test, expect } from '@playwright/test';

test('home page loads under the base path', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/dayline|every day/i);
});
