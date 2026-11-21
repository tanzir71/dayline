import { useEffect, useRef, useState } from 'preact/hooks';
import { isNative } from '../native/is-native';

const HOLD_MS = 1000;

/** Keep a show-mode screen in place: no hash changes and no Back until `leave` is called. Screen stays awake. */
export function useShowLock(prefix: string): (to: string) => void {
  const leaving = useRef(false);
  const route = useRef(location.hash);
  useEffect(() => {
    route.current = location.hash;
    history.pushState({ show: true }, '', location.href);
    const onPop = () => {
      if (!leaving.current) history.pushState({ show: true }, '', route.current);
    };
    const onHash = () => {
      if (!leaving.current && location.hash !== route.current && !location.hash.startsWith(prefix)) {
        history.replaceState(history.state, '', route.current);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else route.current = location.hash;
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onHash);
    let lock: WakeLockSentinel | null = null;
    const ask = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* not supported or not allowed */
      }
      if (import.meta.env.PUBLIC_NATIVE === '1' && !lock && isNative()) void import('../native/bridge').then((b) => b.keepAwake(true));
    };
    void ask();
    const onVis = () => document.visibilityState === 'visible' && void ask();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
      if (import.meta.env.PUBLIC_NATIVE === '1' && isNative()) void import('../native/bridge').then((b) => b.keepAwake(false));
    };
  }, []);
  return (to: string) => {
    leaving.current = true;
    location.hash = to;
  };
}

/** Done that needs a one-second press, so a child can't leave by accident. */
export function HoldButton({ label, hint, onDone }: { label: string; hint: string; onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  function start(e?: Event) {
    e?.preventDefault();
    if (timer.current) return;
    started.current = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - started.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        timer.current = null;
        onDone();
        return;
      }
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
  }
  function end() {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    setProgress(0);
  }
  return (
    <>
      <button
        type="button"
        class="btn btn--secondary btn--block hold"
        style={{ '--hold': String(progress) }}
        onPointerDown={start}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && start(e)}
        onKeyUp={end}
        onContextMenu={(e) => e.preventDefault()}
        aria-describedby="hold-hint"
      >
        {label}
      </button>
      <p id="hold-hint" class="t-caption-13 muted center">
        {progress > 0 ? hint : ' '}
      </p>
    </>
  );
}
