import { useApp } from '../context';
import { useChildData, useEvents } from '../data';
import { useNow } from '../live';
import { Icon } from '../../components/Icon';
import { fmt } from '../../i18n';
import { addDays, localDay } from '../../lib/time';
import { buildBrief } from '../brief';
import { markDose } from '../actions';
import type { Lang } from '../../data/types';
import { HoldButton, useShowLock } from '../lock';

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
  const leave = useShowLock('#/show/');

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
        <HoldButton label={B.done} hint={B.hold} onDone={() => leave('#/today')} />
      </div>
    </div>
  );
}
