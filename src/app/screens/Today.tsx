import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useCareData, useChildData, useEvents } from '../data';
import { visitNudge } from './Visits';
import { CheckInCard } from './CheckIn';
import { REVIEW_WINDOW, SETTLE_DAYS } from '../../domain/daily';
import { useLive, useNow } from '../live';
import { NavBar, TimelineItem, Sheet } from '../ui';
import { Icon } from '../../components/Icon';
import { Overline } from '../../components/Overline';
import { GuideRow } from '../../components/GuideRow';
import { fmt, plural } from '../../i18n';
import { localDay, minutesOf, daysBetween, minutesToHhmm } from '../../lib/time';
import { plannedDoses, nextDose, isDue, daysLeft, isLow } from '../../domain/schedule';
import { describeEvent, KIND_TONE, timeLabel, hhmmLabel, dateLabel, wallTime } from '../format';
import { markDose } from '../actions';
import { go } from '../router';
import type { Tone } from '../../components/tones';

const BACKUP_EVERY_DAYS = 30;

export function Today() {
  const ctx = useApp();
  const { t, lang, child, repos, children, site } = ctx;
  const now = useNow();
  const day = localDay(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const data = useChildData();
  const { events, tags, ready } = useEvents(day, day);
  const [switcher, setSwitcher] = useState(false);
  const care = useCareData();
  const m2 = ctx.flags.insights;
  const visit = m2 ? visitNudge(care.visits, day) : undefined;
  const reviewDue = m2 ? care.changes.find((c) => c.outcome === 'undecided' && day >= c.review_on && daysBetween(c.effective_on, day) <= SETTLE_DAYS + REVIEW_WINDOW + 14) : undefined;
  const visitDoc = visit ? care.prescribers.find((p) => p.id === visit.prescriber_id)?.name ?? t.visits.someone : '';
  const backup = useLive(
    async () => ({ last: await repos.settings.get<string | null>('lastBackup', null), first: await repos.settings.get<string | null>('firstUse', null) }),
    [],
    { last: null as string | null, first: null as string | null },
  );
  const name = child!.name;

  const planned = plannedDoses(day, data.medicines, data.schedules, events);
  const next = nextDose(planned, nowMin);
  const lowStock = data.medicines
    .filter((m) => m.active)
    .map((m) => {
      const stock = data.stocks.find((s) => s.medicine_id === m.id);
      const scheds = data.schedules.filter((s) => s.medicine_id === m.id);
      return { m, left: daysLeft(stock, scheds), low: isLow(stock, scheds) };
    })
    .filter((x) => x.low);
  const since = backup.last ?? backup.first;
  const backupDue = !!since && daysBetween(since.slice(0, 10), day) >= BACKUP_EVERY_DAYS && events.length + data.medicines.length > 0;

  // In-app reminder: say once when a dose becomes due while Dayline is open.
  const told = useRef(new Set<string>());
  useEffect(() => {
    if (ready && data.ready && next && isDue(next, nowMin) && nowMin >= next.minutes) {
      const key = `${day}-${next.medicine.id}-${next.time}`;
      if (!told.current.has(key)) {
        told.current.add(key);
        ctx.toast(fmt(t.today.doseDue, { medicine: next.medicine.generic_name }));
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(fmt(t.nudges.doseTitle, { medicine: next.medicine.generic_name }), {
              body: fmt(t.nudges.doseBody, { amount: next.schedule.amount_text, time: hhmmLabel(next.time, lang) }),
              tag: key,
            });
          }
        } catch {
          /* notifications unavailable */
        }
      }
    }
  }, [ready, data.ready, next?.medicine.id, next?.time, nowMin]);

  async function give() {
    if (!next) return;
    const { undo } = await markDose(ctx, next.medicine, next.time, { amountText: next.schedule.amount_text });
    ctx.toast(fmt(t.events.doseGiven, { medicine: next.medicine.generic_name }), () => void undo());
  }

  // Day line: events, open planned doses, and the Now marker.
  type Item = { key: string; minutes: number; node: preact.JSX.Element };
  const items: Item[] = events.map((e) => {
    const d = describeEvent(e, tags.filter((x) => x.event_id === e.id), data.medicines, ctx);
    return {
      key: e.id,
      minutes: minutesOf(e.started_at),
      node: <TimelineItem key={e.id} time={wallTime(e.started_at, lang)} tone={KIND_TONE[e.kind] ?? 'neutral'} title={d.title} detail={d.detail} />,
    };
  });
  for (const p of planned.filter((x) => !x.event)) {
    const due = isDue(p, nowMin);
    items.push({
      key: `p-${p.medicine.id}-${p.time}`,
      minutes: p.minutes,
      node: (
        <TimelineItem
          key={`p-${p.medicine.id}-${p.time}`}
          time={hhmmLabel(p.time, lang)}
          tone="medicine"
          planned
          title={
            <a href={`#/today?sheet=log&kind=dose&medicine=${p.medicine.id}&time=${p.time}`} class="tl__link">
              {p.medicine.generic_name}
              {p.schedule.amount_text ? `, ${p.schedule.amount_text}` : ''}
            </a>
          }
          detail={due ? t.today.tapWhenGiven : fmt(t.today.reminderAt, { time: hhmmLabel(minutesToHhmm(Math.max(0, p.minutes - 5)), lang) })}
        />
      ),
    });
  }
  items.push({ key: 'now', minutes: nowMin + 0.5, node: <TimelineItem key="now" time={timeLabel(now, lang)} tone="marigold" now title={t.today.now} /> });
  items.sort((a, b) => a.minutes - b.minutes);

  const noters = new Set(events.map((e) => e.noted_by).filter(Boolean));
  const quiet = events.length === 0;

  // "For {name} this week": seasonal picks from the calendar.
  const picks = ctx.calendar
    .map((e) => ({ e, inDays: daysBetween(day, e.start), endsIn: daysBetween(day, e.end) }))
    .filter((x) => x.inDays <= 30 && x.endsIn >= 0)
    .sort((a, b) => a.inDays - b.inDays)
    .flatMap((x) => x.e.guides.map((slug) => ({ ...x, g: ctx.guides.find((g) => g.slug === slug && g.lang === lang) })))
    .filter((x) => x.g)
    .filter((x, i, arr) => arr.findIndex((y) => y.g!.slug === x.g!.slug) === i)
    .slice(0, 2);
  const fallbackPicks = ['help-now', 'meltdown-vs-shutdown']
    .map((slug) => ctx.guides.find((g) => g.slug === slug && g.lang === lang))
    .filter((g) => !!g);

  const otherLangHref = `${ctx.base}${lang === 'en' ? 'bn/' : ''}app/${location.hash}`;

  return (
    <div class="app-screen with-nav with-quick">
      <header class="column app-head">
        <div class="app-head__top">
          <button type="button" class="child-switch" onClick={() => setSwitcher(true)} aria-label={`${t.today.switchChild}: ${name}`}>
            <span class="avatar" aria-hidden="true">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span class="child-switch__name">{name}</span>
            <Icon name="chevron-down" size={16} />
          </button>
          <div class="app-head__actions">
            <a class="lang-pill" href={otherLangHref} data-lang-switch={lang === 'en' ? 'bn' : 'en'} hreflang={lang === 'en' ? 'bn' : 'en'}>
              <span lang="en">EN</span> · <span lang="bn">বাংলা</span>
            </a>
            <a class="round-btn" href="#/today?sheet=share" aria-label={fmt(t.today.share, { name })}>
              <Icon name="share" size={20} />
            </a>
          </div>
        </div>
        <p class="app-head__date t-label-12">{dateLabel(now, lang)}</p>
        <h1 class="screen-title">{t.today.title}</h1>
      </header>

      <main id="main" class="column app-main stack" style="--stack-gap: 10px">
        {quiet && (
          <a class="help-card" href="#/help-now">
            <span>
              <span class="help-card__title">{t.today.helpNowTitle}</span>
              <span class="help-card__body">{fmt(t.today.helpNowBody, { name })}</span>
            </span>
            <span class="help-card__go" aria-hidden="true">
              <Icon name="arrow-right" size={22} />
            </span>
          </a>
        )}

        {next && (!quiet || isDue(next, nowMin)) && (
          <section class="dose-card" aria-label={t.kinds.dose}>
            <div class="dose-card__text">
              <Overline tone="medicine">
                {fmt(isDue(next, nowMin) ? t.today.dueNow : t.today.nextDose, { time: hhmmLabel(next.time, lang) })}
              </Overline>
              <p class="dose-card__name">
                {next.medicine.generic_name}
                {next.schedule.amount_text ? `, ${next.schedule.amount_text}` : ''}
              </p>
              {(next.medicine.notes || next.schedule.with_food) && (
                <p class="t-caption-13 muted">{[next.schedule.with_food ? t.medicines.withFood : '', next.medicine.notes].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <button type="button" class="btn btn--dose" onClick={() => void give()}>
              {t.today.markGiven}
            </button>
          </section>
        )}

        {visit && (
          <section class="nudge tone-medicine">
            <p class="t-body-strong-15">{fmt(t.visits.nudgeTitle, { name: visitDoc, day: dateLabel(new Date(visit.scheduled_at), lang) })}</p>
            <p class="t-body-14 muted">{t.visits.nudgeBody}</p>
            <a class="btn btn--quiet btn--sm" href={`#/visit/${visit.id}`}>
              {t.visits.prep}
            </a>
          </section>
        )}

        {reviewDue && (
          <section class="nudge tone-sleep">
            <p class="t-body-strong-15">{reviewDue.summary}</p>
            <p class="t-body-14 muted">{t.changes.ready}</p>
            <a class="btn btn--quiet btn--sm" href={`#/change/${reviewDue.id}`}>
              {t.changes.whatNext}
            </a>
          </section>
        )}

        {lowStock.map(({ m, left }) => (
          <section class="nudge tone-medicine" key={m.id}>
            <p class="t-body-strong-15">{fmt(t.today.lowStock, { medicine: m.generic_name, n: left ?? 0 }, lang)}</p>
            <p class="t-body-14 muted">{t.today.lowStockBody}</p>
          </section>
        ))}

        <section class="card day-card" aria-labelledby="day-title">
          <div class="day-card__head">
            <h2 id="day-title" class="t-heading-17">
              {quiet ? fmt(t.today.dayTitle, { name }) : t.today.daySoFar}
            </h2>
            <span class="t-caption-13 muted">
              {quiet ? t.today.fromProfile : plural(noters.size, { one: t.today.caregiversOne, other: t.today.caregivers }, lang)}
            </span>
          </div>
          <ol class="timeline" role="list">
            {items.map((i) => i.node)}
          </ol>
          {quiet && <p class="empty-note t-body-14">{data.medicines.length ? t.today.empty : fmt(t.today.noMedicines, { name })}</p>}
          {quiet && !data.medicines.length && (
            <a class="btn btn--quiet btn--sm" href="#/child/medicines/new">
              {t.today.addMedicine}
            </a>
          )}
        </section>

        {!quiet && (
          <a class="help-bar" href="#/help-now">
            <span>{t.today.helpNowTitle}</span>
            <Icon name="arrow-right" size={20} />
          </a>
        )}

        {m2 && <CheckInCard />}

        {backupDue && (
          <section class="nudge tone-monsoon">
            <p class="t-body-strong-15">{t.today.backupTitle}</p>
            <p class="t-body-14 muted">{t.today.backupBody}</p>
            <a class="btn btn--quiet btn--sm" href="#/settings">
              {t.today.backupAction}
            </a>
          </section>
        )}

        <section class="card week-card" aria-label={fmt(t.today.weekFor, { name })}>
          <Overline tone="marigold">{fmt(t.today.weekFor, { name })}</Overline>
          <ul class="guide-list" role="list">
            {(picks.length ? picks.map((p) => ({ g: p.g!, when: p.e.name[lang] })) : fallbackPicks.map((g) => ({ g, when: '' }))).map(({ g, when }) => (
              <li key={g.slug}>
                <GuideRow
                  href={site(`guides/${g.slug}/`)}
                  tone={g.tone as Tone}
                  title={g.title}
                  meta={[ctx.dict.guides.kindGuide, fmt(ctx.dict.guides.minutes, { n: g.read_minutes }, lang), when].filter(Boolean).join(' · ')}
                />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <div class="quick-bar" role="group" aria-label={t.today.quickTitle}>
        <a class="btn btn--hard-moment" href="#/today?sheet=log&kind=hard_moment">
          {t.kinds.hard_moment}
        </a>
        <a class="btn btn--win" href="#/today?sheet=log&kind=win">
          {t.kinds.win}
        </a>
        <a class="btn btn--dose" href="#/today?sheet=log&kind=dose">
          {t.kinds.dose}
        </a>
        <a class="btn btn--secondary quick-bar__more" href="#/today?sheet=log&kind=sleep" aria-label={t.today.more}>
          <Icon name="plus" size={20} />
        </a>
      </div>
      <NavBar active="today" />

      {switcher && (
        <Sheet title={t.today.switchChild} onClose={() => setSwitcher(false)}>
          <ul class="list-plain" role="list">
            {children.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  class={`child-row ${c.id === child!.id ? 'is-current' : ''}`}
                  onClick={() => {
                    ctx.setChild(c.id);
                    setSwitcher(false);
                  }}
                  aria-pressed={c.id === child!.id}
                >
                  <span class="avatar" aria-hidden="true">
                    {c.name.slice(0, 1).toUpperCase()}
                  </span>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            class="btn btn--secondary btn--block"
            onClick={() => {
              setSwitcher(false);
              go('/onboarding');
            }}
          >
            {t.onboarding.addAnother}
          </button>
        </Sheet>
      )}
    </div>
  );
}
