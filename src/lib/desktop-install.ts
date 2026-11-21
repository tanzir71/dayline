// Install on computers (M3): an "Install app" button in the header on desktop Chrome and Edge,
// using the browser's own install prompt. Phones get the bottom sheet instead.
interface DeferredPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
const w = window as unknown as { __daylineInstall?: DeferredPrompt | null };

export function isDesktop(): boolean {
  return !/Android|iPhone|iPad|iPod|Mobi/.test(navigator.userAgent) && !matchMedia('(pointer: coarse)').matches;
}

function sync() {
  const show = !!w.__daylineInstall && isDesktop() && !matchMedia('(display-mode: standalone)').matches;
  document.querySelectorAll<HTMLElement>('[data-install-desktop]').forEach((b) => (b.hidden = !show));
}

// The Android app is already installed: its buttons stay hidden.
if (!import.meta.env.PUBLIC_NATIVE) {
  window.addEventListener('dayline:installable', sync);
  window.addEventListener('appinstalled', () => {
    w.__daylineInstall = null;
    sync();
  });
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true });
  sync();

  document.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement | null)?.closest?.('[data-install-desktop]');
    const ev = w.__daylineInstall;
    if (!b || !ev) return;
    await ev.prompt();
    await ev.userChoice;
    w.__daylineInstall = null;
    sync();
  });
}
