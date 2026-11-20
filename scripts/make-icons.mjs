// Renders the PWA icons, favicon and the Open Graph image from the Figma app icon (2526:17).
// Run with: node scripts/make-icons.mjs   (needs Playwright with Edge or Chromium)
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const MONSOON = '#1A5F5A';
const MARIGOLD = '#F2A93B';
const MIST = '#F3F6F5';
const INK = '#12282C';

// The day line mark: a horizon line, two dots and the marigold "now" dot (viewBox 0 0 160 160).
const mark = `<rect x="22" y="85" width="116" height="6" rx="3" fill="white"/>
<circle cx="43" cy="88" r="9" fill="white"/><circle cx="77" cy="88" r="9" fill="white"/>
<circle cx="118" cy="88" r="18" fill="${MARIGOLD}"/>`;
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="38" fill="${MONSOON}"/>${mark}</svg>`;
const square = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="${MONSOON}"/>${mark}</svg>`;
// Maskable: keep the mark inside the 80% safe zone.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="${MONSOON}"/><g transform="translate(80 80) scale(0.72) translate(-80 -86)">${mark}</g></svg>`;

await mkdir('public/icons', { recursive: true });
await mkdir('public/og', { recursive: true });
await writeFile('public/favicon.svg', rounded + '\n');

const fontData = async (p) => `data:font/woff2;base64,${(await readFile(resolve('node_modules', p))).toString('base64')}`;
const fonts = `
@font-face { font-family: 'Bricolage Grotesque'; font-weight: 200 800; src: url(${await fontData('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2')}); }
@font-face { font-family: 'Figtree'; font-weight: 300 900; src: url(${await fontData('@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2')}); }
@font-face { font-family: 'Hind Siliguri'; font-weight: 600; src: url(${await fontData('@fontsource/hind-siliguri/files/hind-siliguri-bengali-600-normal.woff2')}); }`;

const browser = await chromium.launch({ channel: process.env.CI ? undefined : (process.env.PW_CHANNEL ?? 'msedge') });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(svg, size, out, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="160" height="160"', `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}

await png(rounded, 192, 'public/icons/icon-192.png', true);
await png(rounded, 512, 'public/icons/icon-512.png', true);
await png(maskable, 512, 'public/icons/maskable-512.png');
await png(maskable, 192, 'public/icons/maskable-192.png');
await png(square, 180, 'public/icons/apple-touch-icon.png');
await png(rounded, 96, 'public/icons/shortcut-guides.png', true);

// Help now shortcut icon: ember circle with the line.
const helpIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="38" fill="#BE5625"/><path d="M80 44v52" stroke="white" stroke-width="14" stroke-linecap="round"/><circle cx="80" cy="120" r="9" fill="white"/></svg>`;
await png(helpIcon, 96, 'public/icons/shortcut-help-now.png', true);

// Open Graph image, 1200 x 630.
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><head><style>${fonts}
body{margin:0;width:1200px;height:630px;background:${MIST};font-family:Figtree;color:${INK};display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;position:relative;overflow:hidden}
.wm{font:700 64px/1 'Bricolage Grotesque';letter-spacing:-.02em;display:flex;gap:10px;align-items:flex-start}
.wm i{width:18px;height:18px;border-radius:50%;background:${MARIGOLD};margin-top:12px}
h1{font:700 76px/1.02 'Bricolage Grotesque';letter-spacing:-.01em;margin:44px 0 18px}
p{font:500 30px/1.35 Figtree;color:#4A5E62;margin:0;max-width:820px}
.bn{font:600 30px/1.4 'Hind Siliguri';color:${MONSOON};margin-top:18px}
.line{position:absolute;left:0;right:0;bottom:84px;height:8px;background:${MONSOON}}
.d{position:absolute;bottom:72px;width:32px;height:32px;border-radius:50%;background:${MONSOON}}
.now{position:absolute;bottom:60px;right:120px;width:56px;height:56px;border-radius:50%;background:${MARIGOLD};box-shadow:0 0 0 10px #FDEFD6}
</style></head><body>
<div class="wm">dayline<i></i></div>
<h1>Every day, on one line.</h1>
<p>A day record for families of autistic children, kept on your phone. Works offline. No account.</p>
<p class="bn">প্রতিটি দিন, এক লাইনে।</p>
<div class="line"></div><div class="d" style="left:220px"></div><div class="d" style="left:520px"></div><div class="d" style="left:820px"></div><div class="now"></div>
</body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'public/og/dayline.png' });

await browser.close();
console.log('icons and og image written');
