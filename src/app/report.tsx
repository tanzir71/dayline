import { getDict, fmt, formatNumber } from '../i18n';
import type { AppCtx } from './context';
import type { ChildData } from './data';
import type { Change, DayEvent, EventTag, Lang, Prescriber, Visit } from '../data/types';
import { addDays, dayOf, daysBetween, localDay } from '../lib/time';
import { buildDailyTable, reviewChange, windowStats, type DayRow } from '../domain/daily';
import { labelMatches, SYMPTOMS, type LabelSummary } from '../domain/labels';
import { ageLabel, duration, shortDate } from './format';

const MAX_PERIOD_DAYS = 120;

export interface ReportModel {
  lang: Lang;
  t: ReturnType<typeof getDict>['app'];
  name: string;
  age: string;
  prescriber: string;
  from: string;
  to: string;
  days: number;
  covered: number;
  people: number;
  tiles: { key: string; label: string; value: string; sub: string; tone: 'good' | 'plain' | 'caution' }[];
  memory: string[];
  changes: { date: string; summary: string; decided: string; other: boolean; saw: string }[];
  weeks: { label: string; count: number; covered: number; marker: boolean }[];
  markerNote: string;
  labels: { title: string; line: string }[];
  questions: string[];
  medicines: { name: string; detail: string }[];
  made: string;
  sub: string;
}

/** The period a report covers: since this prescriber's last visit, or since the record began. */
export function reportPeriod(visit: Visit, visits: Visit[], events: DayEvent[], childCreated: string, today: string): { from: string; to: string } {
  const to = dayOf(visit.scheduled_at) < today ? dayOf(visit.scheduled_at) : today;
  const prev = visits
    .filter((v) => v.id !== visit.id && !v.deleted_at && v.prescriber_id === visit.prescriber_id && dayOf(v.scheduled_at) < dayOf(visit.scheduled_at))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))[0];
  const start = visit.report_period_start ?? (prev ? dayOf(prev.scheduled_at) : [dayOf(childCreated), ...events.map((e) => dayOf(e.started_at))].sort()[0]!);
  const from = daysBetween(start, to) > MAX_PERIOD_DAYS ? addDays(to, -MAX_PERIOD_DAYS) : start > to ? to : start;
  return { from, to };
}

export function buildReport(
  ctx: AppCtx,
  lang: Lang,
  data: ChildData,
  visit: Visit,
  prescribers: Prescriber[],
  visits: Visit[],
  events: DayEvent[],
  tags: EventTag[],
  changes: Change[],
  labels: LabelSummary[],
): ReportModel {
  const t = getDict(lang).app;
  const R = t.report;
  const n = (v: number) => formatNumber(v, lang);
  const child = ctx.child!;
  const today = localDay();
  const { from, to } = reportPeriod(visit, visits, events, child.created_at, today);
  const rows: DayRow[] = buildDailyTable(events, tags, from, to);
  const stats = windowStats(rows);
  const inPeriod = events.filter((e) => dayOf(e.started_at) >= from && dayOf(e.started_at) <= to);
  const people = new Set(inPeriod.map((e) => e.noted_by).filter(Boolean)).size;
  const presc = prescribers.find((p) => p.id === visit.prescriber_id);

  // Weeks ending on the report day, oldest first.
  const weeks: ReportModel['weeks'] = [];
  for (let end = to; end >= from; end = addDays(end, -7)) {
    const start = addDays(end, -6) < from ? from : addDays(end, -6);
    const wr = rows.filter((r) => r.day >= start && r.day <= end);
    weeks.unshift({
      label: shortDate(`${start}T12:00:00`, lang).replace(/\s\d{4}$/, '').replace(/,?\s[০-৯\d]{4}$/, ''),
      count: wr.reduce((s, r) => s + r.hard, 0),
      covered: wr.filter((r) => r.logged).length,
      marker: changes.some((c) => c.effective_on >= start && c.effective_on <= end),
    });
    if (weeks.length >= 12) break;
  }
  const covWeeks = weeks.filter((w) => w.covered > 0);
  const last2 = covWeeks.slice(-2);
  const earlier = covWeeks.slice(0, -2);
  const perWeek = last2.length ? Math.round(last2.reduce((s, w) => s + w.count, 0) / last2.length) : null;
  const earlierCounts = earlier.map((w) => w.count);

  const sleepLast = windowStats(rows.slice(-14));
  const sleepEarlier = windowStats(rows.slice(0, -14));
  const dosesAll = stats.onTime + stats.late + stats.missed;
  const noBowel = rows.filter((r) => r.noBowel).length;
  const prep = visit.prep;

  const tiles: ReportModel['tiles'] = [
    {
      key: 'hard',
      label: R.hardPerWeek,
      value: perWeek === null ? R.notLogged : fmt(R.aWeek, { n: perWeek }, lang),
      sub: earlierCounts.length ? fmt(R.lastTwo, { from: n(Math.min(...earlierCounts)), to: n(Math.max(...earlierCounts)) }) : prep?.hard_moments ? fmt(R.fromMemory, { answer: t.prep.hardOpts[prep.hard_moments] }) : '',
      tone: perWeek !== null && earlierCounts.length && perWeek < Math.min(...earlierCounts) ? 'good' : 'plain',
    },
    {
      key: 'sleep',
      label: R.avgSleep,
      value: stats.sleepAvgMin === null ? R.notLogged : duration(stats.sleepAvgMin, { t, lang }),
      sub:
        sleepEarlier.sleepAvgMin !== null && sleepLast.sleepAvgMin !== null
          ? fmt(R.was, { value: duration(sleepEarlier.sleepAvgMin, { t, lang }) })
          : prep?.sleep
            ? fmt(R.fromMemory, { answer: t.prep.sleepOpts[prep.sleep] })
            : '',
      tone: 'plain',
    },
    {
      key: 'doses',
      label: R.dosesOnTime,
      value: dosesAll ? `${n(Math.round((stats.onTime / dosesAll) * 100))}%` : R.notLogged,
      sub: dosesAll ? fmt(R.lateMissed, { late: stats.late, missed: stats.missed }, lang) : '',
      tone: 'plain',
    },
    {
      key: 'bowel',
      label: R.noBowel,
      value: rows.some((r) => r.noBowel !== null) ? n(noBowel) : R.notLogged,
      sub: '',
      tone: noBowel > 0 ? 'caution' : 'plain',
    },
  ];

  const memory: string[] = [];
  if (prep?.hard_moments) memory.push(`${t.prep.hard} ${t.prep.hardOpts[prep.hard_moments]}`);
  if (prep?.sleep) memory.push(`${t.prep.sleep} ${t.prep.sleepOpts[prep.sleep]}`);
  if (prep?.new_things.length) memory.push(`${R.newThings}: ${prep.new_things.map((k) => t.prep.newOpts[k as keyof typeof t.prep.newOpts] ?? k).join(', ')}`);

  const periodChanges = changes.filter((c) => !c.deleted_at && c.effective_on >= from && c.effective_on <= to).sort((a, b) => b.effective_on.localeCompare(a.effective_on));
  const allRows = buildDailyTable(events, tags, addDays(from, -20), today);
  const changeRows = periodChanges.map((c) => {
    const r = reviewChange(c, allRows, changes, today);
    let saw = R.tooEarly;
    if (r.ready && r.before.covered && r.after.covered) {
      saw = `${t.changes.daysHard}: ${fmt(t.changes.ofDays, { n: r.before.hardDays, d: r.before.covered }, lang)} → ${fmt(t.changes.ofDays, { n: r.after.hardDays, d: r.after.covered }, lang)}`;
    }
    if (r.overlaps.length) saw = `${saw} · ${R.overlaps}`;
    const other = !!presc && !!c.decided_by && !c.decided_by.toLowerCase().includes(presc.name.toLowerCase());
    return { date: shortDate(`${c.effective_on}T12:00:00`, lang), summary: c.summary, decided: c.decided_by, other, saw };
  });

  const markerChange = periodChanges[periodChanges.length - 1];
  const matches = labelMatches(inPeriod, data.medicines, labels, prep?.new_things ?? []);
  const symName = (k: string) => SYMPTOMS.find((s) => s.key === k)?.[lang] ?? k;

  return {
    lang,
    t,
    name: child.name,
    age: ageLabel(child.birth_month, { t, lang }),
    prescriber: presc ? [presc.name, presc.specialty].filter(Boolean).join(', ') : t.visits.someone,
    from,
    to,
    days: stats.days,
    covered: stats.covered,
    people,
    tiles,
    memory,
    changes: changeRows,
    weeks,
    markerNote: markerChange ? `${markerChange.summary} · ${shortDate(`${markerChange.effective_on}T12:00:00`, lang)}` : '',
    labels: matches.map((m) => ({
      title: m.fromPrep ? fmt(R.labelPrep, { symptom: symName(m.symptom) }) : fmt(R.labelDays, { symptom: symName(m.symptom), n: m.days }, lang),
      line: m.medicines.map((med) => fmt(R.labelLine, { medicine: med })).join(' '),
    })),
    questions: visit.questions.filter((q) => q.trim()),
    medicines: data.medicines
      .filter((m) => m.active)
      .map((m) => {
        const mine = inPeriod.filter((e) => e.kind === 'dose' && (e.data as Record<string, unknown>).medicine_id === m.id);
        const ok = mine.filter((e) => (e.data as Record<string, unknown>).status === 'given').length;
        const sched = data.schedules.find((s) => s.medicine_id === m.id);
        const parts = [sched?.times.join(', '), sched?.amount_text, mine.length ? fmt(R.onTime, { n: Math.round((ok / mine.length) * 100) }, lang) : ''];
        return { name: [m.generic_name, m.strength_text].filter(Boolean).join(' '), detail: parts.filter(Boolean).join(' · ') };
      }),
    made: fmt(R.made, { date: shortDate(`${today}T12:00:00`, lang) }),
    sub: fmt(R.sub, { date: shortDate(`${today}T12:00:00`, lang) }),
  };
}

function WeekChart({ r }: { r: ReportModel }) {
  const max = Math.max(1, ...r.weeks.map((w) => w.count));
  const w = 640;
  const h = 150;
  const gap = 10;
  const bw = (w - gap * (r.weeks.length - 1)) / Math.max(1, r.weeks.length);
  return (
    <svg class="week-chart" viewBox={`0 0 ${w} ${h + 40}`} role="img" aria-label={r.weeks.map((x) => `${x.label}: ${x.count}`).join(', ')}>
      {r.weeks.map((x, i) => {
        const bh = x.covered ? Math.max(4, (x.count / max) * h) : 0;
        const xPos = i * (bw + gap);
        return (
          <g key={i}>
            {x.covered ? (
              <rect x={xPos} y={h - bh + 18} width={bw} height={bh} rx="6" class={x.marker ? 'bar bar--marker' : 'bar'} />
            ) : (
              <rect x={xPos} y={h + 14} width={bw} height="4" rx="2" class="bar bar--empty" />
            )}
            <text x={xPos + bw / 2} y={x.covered ? h - bh + 12 : h + 8} text-anchor="middle" class="bar-num">
              {x.covered ? formatNumber(x.count, r.lang) : ''}
            </text>
            <text x={xPos + bw / 2} y={h + 36} text-anchor="middle" class={x.marker ? 'bar-label bar-label--marker' : 'bar-label'}>
              {x.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Tiles({ r }: { r: ReportModel }) {
  return (
    <div class="r-tiles">
      {r.tiles.map((x) => (
        <div class="r-tile" key={x.key}>
          <span class="r-tile__label">{x.label}</span>
          <strong class="r-tile__value">{x.value}</strong>
          {x.sub && <span class={`r-tile__sub r-tile__sub--${x.tone}`}>{x.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function ChangesTable({ r }: { r: ReportModel }) {
  const R = r.t.report;
  return r.changes.length ? (
    <table class="r-table">
      <thead>
        <tr>
          <th scope="col">{R.colDate}</th>
          <th scope="col">{R.colChange}</th>
          <th scope="col">{R.colDecided}</th>
          <th scope="col">{R.colSaw}</th>
        </tr>
      </thead>
      <tbody>
        {r.changes.map((c, i) => (
          <tr key={i}>
            <td>{c.date}</td>
            <td>
              <strong>{c.summary}</strong>
            </td>
            <td>
              {c.decided}
              {c.other && <span class="r-pill">{R.otherPrescriber}</span>}
            </td>
            <td>{c.saw}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p class="muted">{R.noChanges}</p>
  );
}

function Lists({ r }: { r: ReportModel }) {
  const R = r.t.report;
  return (
    <>
      <section class="r-card">
        <h2 class="r-overline tone-marigold">
          <i />
          {R.questionsFamily}
        </h2>
        {r.questions.length ? (
          <ul class="r-dots">
            {r.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        ) : (
          <p class="muted">{R.noQuestions}</p>
        )}
      </section>
      <section class="r-card">
        <h2 class="r-overline tone-medicine">
          <i />
          {R.medicines}
        </h2>
        {r.medicines.length ? (
          <ul class="r-meds">
            {r.medicines.map((m) => (
              <li key={m.name}>
                <strong>{m.name}</strong>
                <span>{m.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="muted">{R.noMedicines}</p>
        )}
      </section>
    </>
  );
}

function LabelSection({ r }: { r: ReportModel }) {
  const R = r.t.report;
  return (
    <section class="r-card">
      <h2 class="r-h2">{R.labelTitle}</h2>
      {r.labels.length ? (
        <ul class="r-labels">
          {r.labels.map((l) => (
            <li key={l.title}>
              <strong>{l.title}</strong>
              <span>{l.line}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p class="muted">{R.noLabel}</p>
      )}
      <p class="r-foot">{R.labelFootnote}</p>
    </section>
  );
}

function Head({ r }: { r: ReportModel }) {
  const R = r.t.report;
  return (
    <section class="r-card r-child">
      <h2 class="r-child__name">{[r.name, r.age].filter(Boolean).join(', ')}</h2>
      <p>{fmt(R.for, { name: r.prescriber })}</p>
      <p>{fmt(R.period, { from: shortDate(`${r.from}T12:00:00`, r.lang), to: shortDate(`${r.to}T12:00:00`, r.lang), n: r.days }, r.lang)}</p>
      <p class="r-small">{r.covered ? fmt(r.people > 1 ? R.coverage : R.coverageOne, { covered: r.covered, days: r.days, people: r.people }, r.lang) : R.coverageNone}</p>
    </section>
  );
}

/** The report on screen (desktop layout from Figma 2524:284, one column on phones). */
export function ReportView({ r }: { r: ReportModel }) {
  const R = r.t.report;
  return (
    <div class="report" lang={r.lang}>
      <aside class="report__side">
        <Head r={r} />
        <Lists r={r} />
      </aside>
      <div class="report__main">
        <header>
          <h1 class="report__title">{R.title}</h1>
          <p class="muted">{r.sub}</p>
        </header>
        <Tiles r={r} />
        {r.memory.length > 0 && (
          <section class="r-card">
            <ul class="r-dots">
              {r.memory.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        )}
        <section class="r-card">
          <div class="r-card__head">
            <h2 class="r-h2">{fmt(R.changes, { date: shortDate(`${r.from}T12:00:00`, r.lang) })}</h2>
            <span class="muted">{fmt(R.changesCount, { n: r.changes.length }, r.lang)}</span>
          </div>
          <ChangesTable r={r} />
        </section>
        <section class="r-card">
          <div class="r-card__head">
            <h2 class="r-h2">{R.weekly}</h2>
            {r.markerNote && <span class="r-overline tone-medicine"><i />{r.markerNote}</span>}
          </div>
          <WeekChart r={r} />
        </section>
        <LabelSection r={r} />
      </div>
    </div>
  );
}

/** Two A4 pages for the PDF and print. */
export function ReportPages({ r }: { r: ReportModel }) {
  const R = r.t.report;
  const foot = (page: number) => (
    <footer class="pdf-foot">
      <span>
        {r.name} · {fmt(R.pdfTitle, { name: r.name })}
      </span>
      <span>
        {r.made} · {formatNumber(page, r.lang)}/{formatNumber(2, r.lang)}
      </span>
    </footer>
  );
  return (
    <>
      <article class="pdf-page report-page" lang={r.lang}>
        <header class="pdf-head">
          <p class="pdf-wordmark">
            dayline<span />
          </p>
          <h1>{R.title}</h1>
          <p class="pdf-sub">{r.sub}</p>
        </header>
        <Head r={r} />
        <Tiles r={r} />
        {r.memory.length > 0 && (
          <ul class="r-dots">
            {r.memory.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        <section class="r-card">
          <div class="r-card__head">
            <h2 class="r-h2">{fmt(R.changes, { date: shortDate(`${r.from}T12:00:00`, r.lang) })}</h2>
          </div>
          <ChangesTable r={r} />
        </section>
        <section class="r-card">
          <h2 class="r-h2">{R.weekly}</h2>
          <WeekChart r={r} />
          {r.markerNote && <p class="r-small">{r.markerNote}</p>}
        </section>
        {foot(1)}
      </article>
      <article class="pdf-page report-page" lang={r.lang}>
        <LabelSection r={r} />
        <Lists r={r} />
        {foot(2)}
      </article>
    </>
  );
}
