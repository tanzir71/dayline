import { getDict, fmt } from '../i18n';
import type { AppCtx } from './context';
import type { ChildData } from './data';
import { sectionLines, sortedContacts } from './data';
import type { Contact, Lang } from '../data/types';
import { ageLabel, dateLabel, hhmmLabel } from './format';
import { useApp } from './context';
import { useChildData } from './data';
import { Icon } from '../components/Icon';
import { HoldButton, useShowLock } from './lock';

export interface PassportModel {
  lang: Lang;
  t: ReturnType<typeof getDict>['app'];
  name: string;
  sub: string;
  communication: string[];
  distress: string[];
  medicines: string[];
  allergies: string[];
  calms: string[];
  avoid: string[];
  contacts: Contact[];
  emergency: string;
  made: string;
}

const ALLERGY = /allerg|অ্যালার্জি|এলার্জি/i;

/** The hospital passport, built from About the child (Figma design 2545:2). */
export function buildPassport(ctx: AppCtx, data: ChildData, lang: Lang, now = new Date()): PassportModel {
  const t = getDict(lang).app;
  const child = ctx.child!;
  const food = sectionLines(data.profile, 'food');
  const allergyLines = food.filter((l) => ALLERGY.test(l));
  const plays = data.playbook.filter((p) => p.situation === 'hard_moment').map((p) => p.text);
  return {
    lang,
    t,
    name: child.name,
    sub: [ageLabel(child.birth_month, { t, lang }), child.language === 'bn' ? t.common.langBn : t.common.langEn].filter(Boolean).join(' · '),
    communication: sectionLines(data.profile, 'communication'),
    distress: sectionLines(data.profile, 'distress_signs'),
    medicines: data.medicines
      .filter((m) => m.active)
      .map((m) => {
        const s = data.schedules.find((x) => x.medicine_id === m.id);
        return [[m.generic_name, m.strength_text].filter(Boolean).join(' '), s?.times.map((x) => hhmmLabel(x, lang)).join(', '), s?.amount_text].filter(Boolean).join(' · ');
      }),
    allergies: allergyLines.length ? allergyLines : food.slice(0, 2),
    calms: [...sectionLines(data.profile, 'calms'), ...plays].filter((x, i, a) => a.indexOf(x) === i).slice(0, 5),
    avoid: sectionLines(data.profile, 'avoid'),
    contacts: sortedContacts(data.contacts).slice(0, 4),
    emergency: ctx.emergency,
    made: fmt(t.passport.made, { date: dateLabel(now, lang) }),
  };
}

function Box({ title, tone, items, empty }: { title: string; tone: string; items: string[]; empty: string }) {
  return (
    <section class={`pdf-box tone-${tone}`}>
      <h2>
        <i />
        {title}
      </h2>
      {items.length ? (
        <ul>
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : (
        <p class="pdf-empty">{empty}</p>
      )}
    </section>
  );
}

/** One A4 page: for the ER and new doctors, in Bangla or English. */
export function PassportPage({ p }: { p: PassportModel }) {
  const P = p.t.passport;
  const first = p.contacts.find((c) => c.phone);
  return (
    <article class="pdf-page passport-page" lang={p.lang}>
      <header class="pp-head">
        <div>
          <p class="pdf-wordmark">
            dayline<span />
          </p>
          <p class="pp-overline">
            <i />
            {P.title}
          </p>
          <h1>{p.name}</h1>
          <p class="pdf-sub">{p.sub}</p>
        </div>
        <div class="pp-call">
          <p class="pp-call__read">{fmt(P.readFirst, { name: p.name })}</p>
          {first && (
            <p class="pp-call__who">
              {first.name} · {first.phone}
            </p>
          )}
          <p class="pp-call__em">{fmt(P.emergency, { number: p.emergency })}</p>
        </div>
      </header>
      <div class="pp-grid">
        <Box title={fmt(P.communication, { name: p.name })} tone="neutral" items={p.communication} empty={P.empty} />
        <Box title={P.distress} tone="hard-moment" items={p.distress} empty={P.empty} />
        <Box title={P.medicines} tone="medicine" items={[...(p.medicines.length ? p.medicines : [P.noMedicines]), ...p.allergies]} empty={P.empty} />
        <Box title={fmt(P.calms, { name: p.name })} tone="win" items={p.calms} empty={P.empty} />
        <Box title={P.avoid} tone="hard-moment" items={p.avoid} empty={P.empty} />
        <Box
          title={P.contacts}
          tone="neutral"
          items={p.contacts.map((c) => [c.name, p.t.contacts.roles[c.role], c.phone].filter(Boolean).join(' · '))}
          empty={P.empty}
        />
      </div>
      <footer class="pdf-foot">
        <span>
          {p.name} · {P.title}
        </span>
        <span>{p.made}</span>
      </footer>
    </article>
  );
}

/** The passport in show mode: big, simple, locked; Call and a held Done only. */
export function PassportShow({ lang }: { lang: Lang }) {
  const ctx = useApp();
  const data = useChildData();
  const leave = useShowLock('#/passport/');
  const p = buildPassport(ctx, data, lang === 'bn' ? 'bn' : 'en');
  const P = p.t.passport;
  const B = p.t.brief;
  const other: Lang = p.lang === 'en' ? 'bn' : 'en';
  const caller = p.contacts.find((c) => c.phone);
  const section = (title: string, tone: string, items: string[]) =>
    items.length > 0 && (
      <section class="card show__card">
        <p class={`overline tone-${tone}`}>
          <span class="overline__dot" aria-hidden="true" />
          <span class="t-overline-12">{title}</span>
        </p>
        <ul class="dots">
          {items.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </section>
    );
  return (
    <div class="show" lang={p.lang}>
      <header class="show__bar">
        <span class="wordmark wordmark--light wordmark--sm">
          dayline<span class="wordmark__dot" />
        </span>
        <span class="t-label-12">{P.title}</span>
      </header>
      <main id="main" class="column show__main">
        <div class="show__head">
          <p class="t-label-12 muted">{fmt(P.readFirst, { name: p.name })}</p>
          <button type="button" class="lang-pill" lang={other} onClick={() => (location.hash = `#/passport/${other}`)}>
            {B.otherLang}
          </button>
        </div>
        <h1 class="show__title">{p.name}</h1>
        <p class="t-body-15 muted">{p.sub}</p>
        {section(fmt(P.communication, { name: p.name }), 'neutral', p.communication)}
        {section(P.distress, 'hard-moment', p.distress)}
        {section(P.medicines, 'medicine', [...p.medicines, ...p.allergies])}
        {section(fmt(P.calms, { name: p.name }), 'win', p.calms)}
        {section(P.avoid, 'hard-moment', p.avoid)}
      </main>
      <div class="show__actions column">
        <div class={caller ? 'button-row button-row--2' : 'button-row'}>
          {caller && (
            <a class="btn btn--secondary" href={`tel:${caller.phone.replace(/[^0-9+]/g, '')}`}>
              <Icon name="phone" size={18} />
              {fmt(B.call, { name: caller.name })}
            </a>
          )}
          <a class="btn btn--secondary btn--caution" href={`tel:${p.emergency.replace(/[^0-9+]/g, '')}`}>
            {fmt(P.emergency, { number: p.emergency })}
          </a>
        </div>
        <HoldButton label={B.done} hint={B.hold} onDone={() => leave('#/child')} />
      </div>
    </div>
  );
}
