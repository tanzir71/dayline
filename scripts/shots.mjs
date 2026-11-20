// Dev helper: full-page screenshots of URLs at phone and desktop widths.
// Usage: node scripts/shots.mjs <outDir> <url> [url...]
import { chromium } from '@playwright/test';
const [outDir, ...urls] = process.argv.slice(2);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'msedge' });
for (const [name, viewport] of [['phone', { width: 412, height: 917 }], ['desktop', { width: 1440, height: 900 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const slug = new URL(url).pathname.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home';
    await page.screenshot({ path: `${outDir}/${slug}-${name}.png`, fullPage: true });
  }
  await page.close();
}
await browser.close();
