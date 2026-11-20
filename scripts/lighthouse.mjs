// Lighthouse accessibility audit for the built site (run `npm run build` first).
// Fails if any page scores below 95. Uses Chrome from CHROME_PATH, or Edge/Chrome installed locally.
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const PORT = 4330;
const BASE = '/dayline/';
const MIN = 95;
const pages = ['', 'bn/', 'guides/', 'bn/guides/', 'guides/haircut-day/', 'bn/guides/haircut-day/', 'guides/category/sleep/', 'help-now/', 'bn/help-now/', 'privacy/', 'app/', 'bn/app/', 'offline/'];

const candidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean);
const chromePath = candidates.find((p) => existsSync(p));

const server = spawn(process.execPath, ['scripts/serve.mjs', '--port', String(PORT), '--base', BASE], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const flags = ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'];

/** A fresh browser per page, one retry: CI runners sometimes crash a long-lived headless Chrome. */
async function audit(url, attempt = 1) {
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: flags });
  try {
    const result = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['accessibility'], formFactor: 'mobile' });
    return result.lhr;
  } catch (e) {
    if (attempt < 2) return audit(url, attempt + 1);
    throw e;
  } finally {
    chrome.kill();
  }
}

let failed = false;
try {
  for (const p of pages) {
    const lhr = await audit(`http://localhost:${PORT}${BASE}${p}`);
    const score = Math.round((lhr.categories.accessibility.score ?? 0) * 100);
    const failing = Object.values(lhr.audits).filter((a) => a.score === 0 && a.scoreDisplayMode === 'binary').map((a) => a.id);
    console.log(`${score >= MIN ? 'ok  ' : 'FAIL'} ${score}  /${p}${failing.length ? `  (${failing.join(', ')})` : ''}`);
    if (score < MIN) failed = true;
  }
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
