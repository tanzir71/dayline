import type { Page } from '@playwright/test';

/** Dispatch a fake Chrome install event; resolves with whether prompt() was called. */
export async function mockInstallPrompt(page: Page, outcome: 'accepted' | 'dismissed' = 'accepted') {
  await page.evaluate((o) => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    (window as unknown as { __promptCalled: boolean }).__promptCalled = false;
    e.prompt = async () => {
      (window as unknown as { __promptCalled: boolean }).__promptCalled = true;
    };
    e.userChoice = Promise.resolve({ outcome: o });
    window.dispatchEvent(e);
  }, outcome);
}

/** Wait until the service worker controls the page and has precached `path`. */
export async function waitForOffline(page: Page, path: string) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(
    async (p) => {
      const keys = await caches.keys();
      for (const k of keys) {
        const c = await caches.open(k);
        const reqs = await c.keys();
        if (reqs.some((r) => new URL(r.url).pathname.replace(/index\.html$/, '').endsWith(p))) return true;
      }
      return false;
    },
    path,
    { timeout: 30_000, polling: 250 },
  );
}
