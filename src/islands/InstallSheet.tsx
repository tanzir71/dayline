import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { detectPlatform, dismiss, readState, shouldAutoShow, writeState, type Platform } from '../lib/install-state';

interface Strings {
  title: string;
  body: string;
  install: string;
  notNow: string;
  close: string;
  iosTitle: string;
  iosStep1: string;
  iosStep1Hint: string;
  iosStep2: string;
  iosStep2Hint: string;
  manualTitle: string;
  manualStep1: string;
  manualStep1Hint: string;
  manualStep2: string;
  manualStep2Hint: string;
}

/** The Android app option. Only passed when the site has a release. */
export interface AndroidOption {
  apkHref: string;
  howToHref: string;
  title: string;
  appTitle: string;
  appBadge: string;
  appBody: string;
  download: string;
  howTo: string;
  webTitle: string;
  webBody: string;
}

interface DeferredPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __daylineInstall?: DeferredPrompt | null;
  }
}

/** Settle time before the sheet appears on its own (the reader should see the page first). */
const SETTLE_MS = 2500;

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function InstallSheet({ s, iconSrc, android }: { s: Strings; iconSrc: string; android?: AndroidOption }) {
  const [platform, setPlatform] = useState<Platform>('none');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'prompt' | 'ios' | 'manual' | 'android'>('prompt');
  const deferred = useRef<DeferredPrompt | null>(null);
  const firstButton = useRef<HTMLButtonElement>(null);
  const firstLink = useRef<HTMLAnchorElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (location.pathname.includes('/help-now/')) return; // never during Help now
    const p = detectPlatform({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: isStandalone(),
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    });
    setPlatform(p);
    if (p === 'none') return;

    // The "Install app" links in the menu and footer.
    const links = [...document.querySelectorAll<HTMLElement>('[data-install-open]')];
    links.forEach((el) => (el.hidden = false));
    const onLink = (e: Event) => {
      opener.current = e.currentTarget as HTMLElement;
      show(true);
    };
    links.forEach((el) => el.addEventListener('click', onLink));

    let timer: number | undefined;
    const autoShow = () => {
      if (location.pathname.includes('/android/')) return; // never over the install steps
      if (!shouldAutoShow(readState(), new Date())) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => show(false), SETTLE_MS);
    };

    const onInstallable = () => {
      deferred.current = window.__daylineInstall ?? null;
      if (p === 'android') autoShow();
    };
    if (window.__daylineInstall) onInstallable();
    window.addEventListener('dayline:installable', onInstallable);
    const onInstalled = () => {
      writeState({ ...readState(), installed: true });
      setOpen(false);
      links.forEach((el) => (el.hidden = true));
    };
    window.addEventListener('appinstalled', onInstalled);

    // iPhone and browsers without an install event get the steps after the page settles.
    if (p === 'ios' || p === 'manual') {
      if (document.readyState === 'complete') autoShow();
      else window.addEventListener('load', autoShow, { once: true });
    }

    return () => {
      window.clearTimeout(timer);
      links.forEach((el) => el.removeEventListener('click', onLink));
      window.removeEventListener('dayline:installable', onInstallable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function show(fromLink: boolean) {
    if (isStandalone()) return;
    const pf = detectPlatform({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: false,
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    });
    deferred.current = window.__daylineInstall ?? deferred.current;
    if (pf === 'ios') setMode('ios');
    else if (android && /Android/.test(navigator.userAgent)) setMode('android');
    else if (deferred.current) setMode('prompt');
    else if (fromLink || pf === 'manual') setMode('manual');
    else return;
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    (firstLink.current ?? firstButton.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') notNow();
      if (e.key === 'Tab' && sheet.current) {
        const f = [...sheet.current.querySelectorAll<HTMLElement>('a[href],button')];
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, mode]);

  function close() {
    setOpen(false);
    opener.current?.focus();
    opener.current = null;
  }

  function notNow() {
    writeState(dismiss(readState(), new Date()));
    close();
  }

  async function install() {
    const e = deferred.current;
    if (!e) return;
    try {
      await e.prompt();
      const choice = await e.userChoice;
      window.__daylineInstall = null;
      deferred.current = null;
      if (choice.outcome === 'accepted') {
        writeState({ ...readState(), installed: true });
        close();
      } else {
        notNow();
      }
    } catch {
      close();
    }
  }

  /** Add to home screen: the browser's prompt when it offered one, otherwise the manual steps. */
  function addToHome() {
    deferred.current = window.__daylineInstall ?? deferred.current;
    if (deferred.current) void install();
    else setMode('manual');
  }

  if (platform === 'none' || !open) return null;

  const title = mode === 'ios' ? s.iosTitle : mode === 'manual' ? s.manualTitle : mode === 'android' && android ? android.title : s.title;
  return (
    <>
      <div class="sheet-backdrop" onClick={notNow} />
      <div class="sheet install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" ref={sheet} data-mode={mode}>
        <div class="sheet__grabber" aria-hidden="true" />
        {mode === 'android' && android ? (
          <>
            <h2 id="install-title" class="sheet__title">
              {title}
            </h2>
            <div class="install-options">
              <section class="install-option install-option--app">
                <div class="install-option__head">
                  <h3 class="t-heading-17">{android.appTitle}</h3>
                  <span class="install-option__badge t-label-12">
                    <Icon name="mic" size={14} />
                    {android.appBadge}
                  </span>
                </div>
                <p class="t-body-14 muted">{android.appBody}</p>
                <a
                  ref={firstLink}
                  class="btn btn--primary btn--block"
                  href={android.apkHref}
                  download
                  onClick={() => writeState(dismiss(readState(), new Date()))}
                >
                  <Icon name="download" size={20} />
                  {android.download}
                </a>
                <a class="install-option__howto t-body-strong-14" href={android.howToHref}>
                  {android.howTo}
                </a>
              </section>
              <section class="install-option">
                <h3 class="t-heading-17">{android.webTitle}</h3>
                <p class="t-body-14 muted">{android.webBody}</p>
                <button type="button" class="btn btn--secondary btn--block" onClick={addToHome}>
                  {s.install}
                </button>
              </section>
            </div>
          </>
        ) : (
          <div class="install-sheet__head">
            <img src={iconSrc} width="56" height="56" alt="" />
            <div>
              <h2 id="install-title" class="sheet__title">
                {title}
              </h2>
              <p class="t-body-15 muted">{s.body}</p>
            </div>
          </div>
        )}

        {mode === 'ios' && (
          <ol class="install-steps" role="list">
            <li>
              <span class="install-steps__icon" aria-hidden="true">
                <Icon name="ios-share" size={24} />
              </span>
              <span>
                <strong>{s.iosStep1}</strong>
                <span class="t-caption-13 muted">{s.iosStep1Hint}</span>
              </span>
            </li>
            <li>
              <span class="install-steps__icon" aria-hidden="true">
                <Icon name="add-to-home" size={24} />
              </span>
              <span>
                <strong>{s.iosStep2}</strong>
                <span class="t-caption-13 muted">{s.iosStep2Hint}</span>
              </span>
            </li>
          </ol>
        )}

        {mode === 'manual' && (
          <ol class="install-steps" role="list">
            <li>
              <span class="install-steps__icon" aria-hidden="true">
                <Icon name="menu" size={24} />
              </span>
              <span>
                <strong>{s.manualStep1}</strong>
                <span class="t-caption-13 muted">{s.manualStep1Hint}</span>
              </span>
            </li>
            <li>
              <span class="install-steps__icon" aria-hidden="true">
                <Icon name="add-to-home" size={24} />
              </span>
              <span>
                <strong>{s.manualStep2}</strong>
                <span class="t-caption-13 muted">{s.manualStep2Hint}</span>
              </span>
            </li>
          </ol>
        )}

        <div class="sheet__actions">
          {mode === 'prompt' ? (
            <>
              <button ref={firstButton} type="button" class="btn btn--primary btn--block" onClick={() => void install()}>
                {s.install}
              </button>
              <button type="button" class="btn btn--secondary btn--block" onClick={notNow}>
                {s.notNow}
              </button>
            </>
          ) : mode === 'android' ? (
            <button type="button" class="btn btn--ghost btn--block" onClick={notNow}>
              {s.notNow}
            </button>
          ) : (
            <button ref={firstButton} type="button" class="btn btn--secondary btn--block" onClick={notNow}>
              {s.notNow}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
