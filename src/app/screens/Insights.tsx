import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useCareData, useEvents } from '../data';
import { useLive } from '../live';
import { NavBar, Row } from '../ui';
import { Overline } from '../../components/Overline';
import { fmt } from '../../i18n';
import { addDays, localDay } from '../../lib/time';
import type { Pattern, Learning } from '../../domain/patterns';
import { buildDailyTable } from '../../domain/daily';
import { findPatterns, timeOfDay } from '../../domain/patterns';
import { changeStatus } from './Changes';
import { dateLabel, shortDate } from '../format';
import type { DayEvent, EventTag } from '../../data/types';

interface Result {
  patterns: Pattern[];
  learning: Learning[];
  time: { counts: number[]; total: number; peak: number } | null;
  logged: number;
}

const WINDOW_DAYS = 56;

/** Run the patterns engine in a Web Worker; fall back to the main thread where workers can't start. */
function usePatterns(events: DayEvent[], tags: EventTag[], from: string, to: string, ready: boolean): Result | null {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!ready) return;
    let worker: Worker | null = null;
    const local = () => {
      const rows = buildDailyTable(events, tags, from, to);
      setResult({ ...findPatterns(rows), time: timeOfDay(rows), logged: rows.filter((r) => r.logged).length });
    };
    try {
      worker = new Worker(new URL('../../domain/patterns.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<Result>) => setResult(e.data);
      worker.onerror = () => local();
      worker.postMessage({ events, tags, from, to });
    } catch {
      local();
    }
    return () => worker?.terminate();
  }, [ready, events.length, tags.length, from, to]);
  return result;
}

/** Insights (2523:338): change reviews and patterns, with clear "still learning" states. */
export function Insights() {
  const ctx = useApp();
  const { t, lang, child, repos } = ctx;
  const I = t.insights;
  const today = localDay();
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const { events, tags, ready } = useEvents(from, today);
  const care = useCareData();
  const res = usePatterns(events, tags, from, today, ready);
  const feedback = useLive(async () => (child ? await repos.feedback.where('child_id', child.id) : []), [child?.id], []);
  const [open, setOpen] = useState<string | null>(null);
  const next = care.visits.find((v) => v.scheduled_at.slice(0, 10) >= today);
  const docName = (id: string | null) => care.prescribers.find((p) => p.id === id)?.name ?? t.visits.someone;

  async function feedbackOn(key: string, verdict: 'makes_sense' | 'not_this') {
    const old = feedback.find((f) => f.pattern_key === key);
    if (old) await repos.feedback.update(old.id, { verdict });
    else await repos.feedback.add({ child_id: child!.id, pattern_key: key, verdict, note: '' });
    ctx.toast(I.feedbackSaved);
  }

  return (
    <div class="app-screen with-nav">
      <main id="main" class="column app-main stack" style="--stack-gap: 12px">
        <header class="stack" style="--stack-gap: 2px; padding-top: 12px">
          <p class="t-label-12 muted">{fmt(I.sub, { n: res?.logged ?? 0 }, lang)}</p>
          <h1 class="screen-title">{I.title}</h1>
        </header>

        <section class="card stack" style="--stack-gap: 8px">
          <div class="day-card__head">
            <h2 class="t-heading-17">{I.visits}</h2>
            <a class="t-body-strong-14" href="#/visits">
              {t.visits.title}
            </a>
          </div>
          {next ? (
            <Row href={`#/visit/${next.id}`} tone="medicine" title={docName(next.prescriber_id)} detail={`${dateLabel(new Date(next.scheduled_at), lang)} · ${t.visits.prep}`} />
          ) : (
            <a class="btn btn--quiet btn--sm" href="#/visits?add=1">
              {t.visits.add}
            </a>
          )}
        </section>

        <section class="card stack" style="--stack-gap: 8px">
          <div class="day-card__head">
            <h2 class="t-heading-17">{I.changes}</h2>
            <a class="t-body-strong-14" href="#/change/new">
              + {t.changes.add}
            </a>
          </div>
          {care.changes.length ? (
            <ul class="guide-list" role="list">
              {care.changes.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Row href={`#/change/${c.id}`} tone="medicine" title={c.summary} detail={`${shortDate(`${c.effective_on}T12:00:00`, lang)} · ${changeStatus(c, today, t, lang)}`} />
                </li>
              ))}
            </ul>
          ) : (
            <p class="t-body-14 muted">{t.changes.none}</p>
          )}
        </section>

        <h2 class="t-heading-17">{I.patterns}</h2>
        {res === null ? null : (
          <>
            {res.patterns.map((p) => {
              const verdict = feedback.find((f) => f.pattern_key === p.key)?.verdict;
              return (
                <section class="card stack pattern" style="--stack-gap: 10px" key={p.key}>
                  <Overline tone="sleep">
                    {I.seenTogether}
                    {p.steady ? ` · ${I.steady}` : ''}
                  </Overline>
                  <h3 class="t-heading-17">{I.factorTitle[p.factor]}</h3>
                  <p class="t-caption-13 muted">{fmt(I.factorWith[p.factor], { hit: p.withHits.length, n: p.withDays.length }, lang)}</p>
                  <Squares hit={p.withHits.length} total={p.withDays.length} />
                  <p class="t-caption-13 muted">{fmt(I.otherDays, { hit: p.withoutHits.length, n: p.withoutDays.length }, lang)}</p>
                  <Squares hit={p.withoutHits.length} total={p.withoutDays.length} />
                  <div class="chip-group">
                    <button type="button" class={`chip ${verdict === 'makes_sense' ? 'chip--toggled' : 'chip--default'}`} aria-pressed={verdict === 'makes_sense'} onClick={() => void feedbackOn(p.key, 'makes_sense')}>
                      {I.makesSense}
                    </button>
                    <button type="button" class={`chip ${verdict === 'not_this' ? 'chip--toggled' : 'chip--default'}`} aria-pressed={verdict === 'not_this'} onClick={() => void feedbackOn(p.key, 'not_this')}>
                      {I.notThis}
                    </button>
                    <button type="button" class="chip chip--default" aria-expanded={open === p.key} onClick={() => setOpen(open === p.key ? null : p.key)}>
                      {open === p.key ? I.hideDays : I.seeDays}
                    </button>
                  </div>
                  {open === p.key && (
                    <div class="raw-days">
                      <RawDays title={I.daysWith} days={p.withDays} hits={p.withHits} />
                      <RawDays title={I.daysWithout} days={p.withoutDays} hits={p.withoutHits} />
                    </div>
                  )}
                </section>
              );
            })}
            {res.time && (
              <section class="card stack" style="--stack-gap: 10px">
                <Overline tone="hard-moment">{I.timeOfDay}</Overline>
                <h3 class="t-heading-17">{fmt(I.timeTitle, { bucket: I.buckets[res.time.peak] ?? '' })}</h3>
                <div class="tod" role="img" aria-label={I.bucketLabels.map((b, i) => `${b}: ${res.time!.counts[i]}`).join(', ')}>
                  {res.time.counts.map((c, i) => (
                    <div class="tod__col" key={i}>
                      <span class={`tod__bar ${i === res.time!.peak ? 'is-peak' : ''}`} style={{ height: `${Math.max(6, (c / Math.max(1, ...res.time!.counts)) * 90)}px` }} />
                      <span class={`tod__label ${i === res.time!.peak ? 'is-peak' : ''}`}>{I.bucketLabels[i]}</span>
                    </div>
                  ))}
                </div>
                <p class="t-caption-13 muted">{fmt(I.timeLine, { n: res.time.counts[res.time.peak] ?? 0, total: res.time.total }, lang)}</p>
              </section>
            )}
            {res.learning.map((l) => (
              <section class="card stack" style="--stack-gap: 6px" key={l.factor}>
                <Overline tone="neutral">{I.learning}</Overline>
                <p class="t-body-14">{fmt(I.learningLine, { factor: I.factorName[l.factor], n: l.have }, lang)}</p>
              </section>
            ))}
            {!res.patterns.length && !res.learning.length && !res.time && <p class="empty-note t-body-14">{I.nothingYet}</p>}
            {!res.patterns.length && (res.learning.length > 0 || !!res.time) && res.logged >= 14 && <p class="t-body-14 muted">{I.noPatterns}</p>}
          </>
        )}

        {care.checkIns.length > 0 && (
          <section class="card stack" style="--stack-gap: 6px">
            <h2 class="t-heading-17">{I.checkIns}</h2>
            <ul class="list-plain" role="list">
              {care.checkIns.slice(0, 4).map((c) => (
                <li key={c.id} class="t-body-14">
                  <strong>{shortDate(`${c.week_start}T12:00:00`, lang)}</strong>
                  {' · '}
                  {[
                    c.sleep ? `${t.checkIn.sleep}: ${t.checkIn.opts[c.sleep]}` : '',
                    c.mood ? `${t.checkIn.mood}: ${t.checkIn.moodOpts[c.mood]}` : '',
                    c.hard_moments ? `${t.checkIn.hard}: ${t.checkIn.opts[c.hard_moments]}` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </li>
              ))}
            </ul>
          </section>
        )}
        <p class="t-caption-13 muted">{I.boundary}</p>
      </main>
      <NavBar active="insights" />
    </div>
  );
}

function Squares({ hit, total }: { hit: number; total: number }) {
  return (
    <div class="squares" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} class={i < hit ? 'is-hit' : ''} />
      ))}
    </div>
  );
}

function RawDays({ title, days, hits }: { title: string; days: string[]; hits: string[] }) {
  const { t, lang } = useApp();
  return (
    <div>
      <h4 class="t-body-strong-14">{title}</h4>
      <ul class="list-plain raw-days__list" role="list">
        {days.map((d) => (
          <li key={d}>
            <a href={`#/day/${d}`}>{shortDate(`${d}T12:00:00`, lang)}</a> · {hits.includes(d) ? t.insights.hardYes : t.insights.hardNo}
          </li>
        ))}
      </ul>
    </div>
  );
}
