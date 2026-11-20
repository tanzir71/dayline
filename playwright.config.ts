import { defineConfig, devices } from '@playwright/test';

// Tests run against the production build served under a sub-path, like GitHub Pages.
const PORT = 4329;
const BASE = '/dayline/';
// Locally we drive the installed Microsoft Edge; CI installs Playwright's Chromium.
const channel = process.env.CI ? undefined : (process.env.PW_CHANNEL ?? 'msedge');

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: {
    command: `npm run build && node scripts/serve.mjs --port ${PORT} --base ${BASE}`,
    url: `http://localhost:${PORT}${BASE}`,
    env: { PUBLIC_BASE_PATH: BASE, PUBLIC_SITE_URL: `http://localhost:${PORT}` },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
