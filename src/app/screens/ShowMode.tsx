import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useChildData, useEvents } from '../data';
import { useNow } from '../live';
import { Icon } from '../../components/Icon';
import { fmt } from '../../i18n';
import { addDays, localDay } from '../../lib/time';
import { buildBrief } from '../brief';
import { markDose } from '../actions';
import type { Lang } from '../../data/types';

const HOLD_MS = 1000;

/**
 * Show mode (2523:179): the brief, full screen, big type, no navigation.
 * Only Mark given, Call and Done work; Done needs a one-second press so a child can't leave by accident.
 */
export function ShowMode({ briefLang }: { briefLang: Lang }) {
  const ctx = useApp();
  const { emergency } = ctx;
  const lang: Lang = briefLang === 'bn' ? 'bn' : 'en';
  const data = useChildData();
  const today = localDay();
  const { events, tags } = useEvents(addDays(today, -1), today);
  const now = useNow();
  const b = buildBrief(ctx, data, events, tags, lang, now);
  const B = b.t.brief;
  const [progress, setProgress] = useState(0);
  const leaving = useRef(false);
  const timer = useRef<number | null>(null);
  const started = useRef(0);
  const route = useRef(location.hash);

  // Stay here: no hash changes and no Back until Done is held.
  useEffect(() => {
    route.current = location.hash;
    history.pushState({ show: true }, '', location.href);
    const onPop = () => {
      if (!leaving.current) history.pushState({ show: true }, '', route.current);
    };
    const onHash = () => {
      if (!leaving.current && location.hash !== route.current && !location.hash.startsWith('#/show/')) {
        history.replaceState(history.state, '', route.current);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else route.current = location.hash;
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  // Keep the screen awake while the phone is handed over.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const ask = async () => {
      try {
        lock = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        /* not supported or not allowed */
      }
    };
    void ask();
    const onVis = () => document.visibilityState === 'visible' && void ask();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, []);

  function holdStart(e?: Event) {
    e?.preventDefault();
    if (timer.current) return;
    started.current = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - started.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        timer.current = null;
        leaving.current = true;
        location.hash = '#/today';
        return;
      }
      timer.current = requestAnimationFrame(tick);
    };
    timer.current = requestAnimationFrame(tick);
  }
  function holdEnd() {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    setProgress(0);
  }

  async function give() {
    if (!b.next) return;
    await markDose(ctx, b.next.medicine, b.next.time, { amountText: b.next.schedule.amount_text, source: 'show_mode', notedBy: null });
  }

  const caller = b.contacts.find((c) => c.phone);
  const other: Lang = lang === 'en' ? 'bn' : 'en';

  return (
    <div class="show" lang={lang}>
      <header class="show__bar">
        <span class="wordmark wordmark--light wordmark--sm">
          dayline<span class="wordmark__dot" />
        </span>
        <span class="t-label-12">{B.mode}</span>
      </header>
      <main id="main" class="column show__main">
        <div class="show__head">
          <p class="t-label-12 muted">{B.handingOver}</p>
          <button type="button" class="lang-pill" lang={other} onClick={() => (location.hash = `#/show/${other}`)}>
            {B.otherLang}
          </button>
        </div>
        <h1 class="show__title">{b.title}</h1>
        <div class="tiles">
          {b.tiles.map((x) => (
            <div class={`tile tone-${x.tone}`} key={x.key}>
              <span class="tile__label">
                <i aria-hidden="true" />
                {x.label}
              </span>
              <span class="tile__value">{x.value}</span>
            </div>
          ))}
        </div>
        {b.next && (
          <section class="dose-card">
            <div class="dose-card__text">
              <p class="overline tone-medicine">
                <span class="overline__dot" aria-hidden="true" />
                <span class="t-overline-12">{b.nextLabel}</span>
              </p>
              <p class="dose-card__name">{[b.next.medicine.generic_name, b.next.schedule.amount_text].filter(Boolean).join(', ')}</p>
              {b.next.medicine.notes && <p class="t-caption-13 muted">{b.next.medicine.notes}</p>}
            </div>
            <button type="button" class="btn btn--dose" onClick={() => void give()}>
              {b.t.today.markGiven}
            </button>
          </section>
        )}
        {b.watch.length > 0 && (
          <section class="card show__card">
            <p class="overline tone-marigold">
              <span class="overline__dot" aria-hidden="true" />
              <span class="t-overline-12">{B.watchFor}</span>
            </p>
            <ul class="dots">
              {b.watch.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        )}
        <section class="card show__card">
          <p class="overline tone-win">
            <span class="overline__dot" aria-hidden="true" />
            <span class="t-overline-12">{fmt(B.calms, { name: b.name })}</span>
          </p>
          {b.calms.length || b.avoid.length ? (
            <ul class="dots">
              {b.calms.map((c) => (
                <li key={c.text}>{c.text}</li>
              ))}
              {b.avoid.map((x) => (
                <li key={x} class="tone-hard-moment">
                  <strong>{B.avoid}</strong>: {x}
                </li>
              ))}
            </ul>
          ) : (
            <p class="t-body-14 muted">{fmt(B.empty, { name: b.name })}</p>
          )}
        </section>
        {b.communication.length > 0 && (
          <section class="card show__card">
            <p class="overline tone-neutral">
              <span class="overline__dot" aria-hidden="true" />
              <span class="t-overline-12">{fmt(B.communication, { name: b.name })}</span>
            </p>
            <ul class="dots">
              {b.communication.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <div class="show__actions column">
        <div class={caller ? 'button-row button-row--2' : 'button-row'}>
          {caller && (
            <a class="btn btn--secondary" href={`tel:${caller.phone.replace(/[^0-9+]/g, '')}`}>
              <Icon name="phone" size={18} />
              {fmt(B.call, { name: caller.name })}
            </a>
          )}
          <a class="btn btn--secondary btn--caution" href={`tel:${emergency.replace(/[^0-9+]/g, '')}`}>
            {fmt(ctx.dict.helpNow.emergency, { number: emergency })}
          </a>
        </div>
        <button
          type="button"
          class="btn btn--secondary btn--block hold"
          style={{ '--hold': String(progress) }}
          onPointerDown={holdStart}
          onPointerUp={holdEnd}
          onPointerLeave={holdEnd}
          onPointerCancel={holdEnd}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && holdStart(e)}
          onKeyUp={holdEnd}
          onContextMenu={(e) => e.preventDefault()}
          aria-describedby="hold-hint"
        >
          {B.done}
        </button>
        <p id="hold-hint" class="t-caption-13 muted center">
          {progress > 0 ? B.hold : ' '}
        </p>
      </div>
    </div>
  );
}
