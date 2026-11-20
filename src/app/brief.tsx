import { getDict, fmt } from '../i18n';
import type { AppCtx } from './context';
import type { ChildData } from './data';
import { sectionLines, sortedContacts } from './data';
import type { Contact, DayEvent, EventTag, Lang } from '../data/types';
import { plannedDoses, nextDose, type PlannedDose } from '../domain/schedule';
import { localDay, addDays, dayOf } from '../lib/time';
import { describeEvent, duration, hardWord, hhmmLabel, minutesBetween, timeLabel, wallTime, dateLabel } from './format';

export interface BriefModel {
  lang: Lang;
  t: ReturnType<typeof getDict>['app'];
  name: string;
  title: string;
  tiles: { key: string; tone: string; label: string; value: string }[];
  next: PlannedDose | null;
  nextLabel: string;
  doses: { label: string; time: string; status: string }[];
  watch: string[];
  communication: string[];
  calms: { text: string; strong?: string }[];
  avoid: string[];
  food: string[];
  contacts: Contact[];
  date: string;
  madeOn: string;
}

/**
 * The brief is generated, never typed: profile, playbook and today's events at the moment it is shown
 * or turned into a PDF, in the language chosen in the share sheet.
 */
export function buildBrief(
  ctx: AppCtx,
  data: ChildData,
  events: DayEvent[],
  tags: EventTag[],
  lang: Lang,
  now = new Date(),
): BriefModel {
  const t = getDict(lang).app;
  const B = t.brief;
  const bctx = { ...ctx, t, lang };
  const child = ctx.child!;
  const name = child.name;
  const today = localDay(now);
  const todays = events.filter((e) => dayOf(e.started_at) === today);
  const describe = (e: DayEvent) => describeEvent(e, tags.filter((x) => x.event_id === e.id), data.medicines, bctx);

  const sleep = [...events].reverse().find((e) => e.kind === 'sleep' && (dayOf(e.started_at) === today || dayOf(e.started_at) === addDays(today, -1)));
  let sleepText = B.notNoted;
  if (sleep) {
    const mins = minutesBetween(sleep.started_at, sleep.ended_at);
    const w = Number((sleep.data as Record<string, unknown>).night_wakings ?? 0);
    sleepText = [mins ? duration(mins, bctx) : t.kinds.sleep, w === 1 ? t.events.wakingsOne.toLowerCase() : w > 1 ? fmt(t.events.wakings, { n: w }, lang).toLowerCase() : '']
      .filter(Boolean)
      .join(', ');
  }
  const foods = todays.filter((e) => e.kind === 'food');
  const foodText = foods.length ? foods.map((e) => describe(e).title).join(', ') : B.notNoted;
  const gutEvent = [...events].reverse().find((e) => e.kind === 'food' && (e.data as Record<string, unknown>).gut);
  const gutText = gutEvent ? t.log.guts[(gutEvent.data as Record<string, string>).gut as keyof typeof t.log.guts] : B.notNoted;
  const hard = todays.filter((e) => e.kind === 'hard_moment').length;
  const wins = todays.filter((e) => e.kind === 'win').length;
  const soFar = hard + wins ? fmt(B.soFarCounts, { hard, wins, word: hardWord(child, bctx).toLowerCase() }, lang) : B.soFarNone;

  const planned = plannedDoses(today, data.medicines, data.schedules, events);
  const next = nextDose(planned, now.getHours() * 60 + now.getMinutes());
  const doses = planned.map((p) => ({
    label: [p.medicine.generic_name, p.schedule.amount_text].filter(Boolean).join(', '),
    time: hhmmLabel(p.time, lang),
    status: p.event ? fmt(B.givenAt, { time: wallTime(p.event.started_at, lang) }) : '',
  }));

  const plays = data.playbook.filter((p) => p.situation === 'hard_moment').slice(0, 4);
  const calms = [...plays.map((p) => ({ text: p.text })), ...sectionLines(data.profile, 'calms').map((text) => ({ text }))].slice(0, 6);

  return {
    lang,
    t,
    name,
    title: fmt(B.from, { name, time: timeLabel(now, lang) }),
    tiles: [
      { key: 'sleep', tone: 'sleep', label: B.sleep, value: sleepText },
      { key: 'food', tone: 'food', label: B.food, value: foodText },
      { key: 'bathroom', tone: 'food', label: B.bathroom, value: gutText },
      { key: 'soFar', tone: 'hard-moment', label: B.soFar, value: soFar },
    ],
    next,
    nextLabel: next ? fmt(B.yourJob, { time: hhmmLabel(next.time, lang) }) : '',
    doses,
    watch: sectionLines(data.profile, 'distress_signs'),
    communication: sectionLines(data.profile, 'communication'),
    calms,
    avoid: sectionLines(data.profile, 'avoid'),
    food: sectionLines(data.profile, 'food'),
    contacts: sortedContacts(data.contacts).filter((c) => c.phone || c.name),
    date: dateLabel(now, lang),
    madeOn: fmt(B.madeOn, { date: dateLabel(now, lang) }),
  };
}

/** The one-page A4 brief (also the print layout). Rendered to an image for the PDF so Bangla is shaped by the browser. */
export function BriefPage({ b }: { b: BriefModel }) {
  const B = b.t.brief;
  return (
    <article class="pdf-page brief-page" lang={b.lang}>
      <header class="pdf-head">
        <p class="pdf-wordmark">
          dayline<span />
        </p>
        <h1>{fmt(B.pdfTitle, { name: b.name })}</h1>
        <p class="pdf-sub">{b.title}</p>
      </header>
      <section class="pdf-tiles">
        {b.tiles.map((x) => (
          <div class={`pdf-tile tone-${x.tone}`} key={x.key}>
            <span class="pdf-label">
              <i />
              {x.label}
            </span>
            <strong>{x.value}</strong>
          </div>
        ))}
      </section>
      <section class="pdf-box tone-medicine">
        <h2>
          <i />
          {B.doses}
        </h2>
        {b.doses.length ? (
          <ul>
            {b.doses.map((d) => (
              <li key={d.label + d.time}>
                <strong>{d.time}</strong> {d.label}
                {d.status && <em> · {d.status}</em>}
              </li>
            ))}
          </ul>
        ) : (
          <p>{B.noDoses}</p>
        )}
      </section>
      <div class="pdf-cols">
        <section class="pdf-box tone-win">
          <h2>
            <i />
            {fmt(B.calms, { name: b.name })}
          </h2>
          {b.calms.length ? (
            <ul>
              {b.calms.map((c) => (
                <li key={c.text}>{c.text}</li>
              ))}
            </ul>
          ) : (
            <p class="pdf-empty">{fmt(B.empty, { name: b.name })}</p>
          )}
          {b.avoid.length > 0 && (
            <>
              <h3>{B.avoid}</h3>
              <ul>
                {b.avoid.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section class="pdf-box tone-marigold">
          <h2>
            <i />
            {B.watchFor}
          </h2>
          {b.watch.length ? (
            <ul>
              {b.watch.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p class="pdf-empty">{fmt(B.empty, { name: b.name })}</p>
          )}
          {b.communication.length > 0 && (
            <>
              <h3>{fmt(B.communication, { name: b.name })}</h3>
              <ul>
                {b.communication.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      <div class="pdf-cols">
        <section class="pdf-box tone-food">
          <h2>
            <i />
            {B.foodNotes}
          </h2>
          {b.food.length ? (
            <ul>
              {b.food.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p class="pdf-empty">{B.notNoted}</p>
          )}
        </section>
        <section class="pdf-box tone-neutral">
          <h2>
            <i />
            {B.contacts}
          </h2>
          {b.contacts.length ? (
            <ul class="pdf-contacts">
              {b.contacts.map((c) => (
                <li key={c.id}>
                  <strong>{c.name}</strong> · {b.t.contacts.roles[c.role]}
                  {c.phone && <span class="pdf-phone"> · {c.phone}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p class="pdf-empty">{B.notNoted}</p>
          )}
        </section>
      </div>
      <footer class="pdf-foot">
        <span>{b.name}</span>
        <span>{b.madeOn}</span>
      </footer>
    </article>
  );
}
