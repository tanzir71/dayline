import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { useCareData, useChildData, useEvents } from '../data';
import { Field, ScreenHeader, TextInput } from '../ui';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { Overline } from '../../components/Overline';
import { fmt, formatNumber } from '../../i18n';
import { addDays, localDay } from '../../lib/time';
import { buildDailyTable, reviewChange, REVIEW_WINDOW, SETTLE_DAYS, type WindowStats } from '../../domain/daily';
import { duration, shortDate } from '../format';
import { go, useRoute } from '../router';
import { CHANGE_TYPES, type Change, type ChangeType } from '../../data/types';

export function ChangeForm() {
  const ctx = useApp();
  const { t, child, repos, lang } = ctx;
  const C = t.changes;
  const route = useRoute();
  const data = useChildData();
  const [type, setType] = useState<ChangeType>((route.query.get('type') as ChangeType) ?? 'dose_change');
  const [summary, setSummary] = useState(route.query.get('summary') ?? '');
  const [reason, setReason] = useState('');
  const [decided, setDecided] = useState('');
  const [effective, setEffective] = useState(localDay());
  const medicineId = route.query.get('medicine');

  async function save(e: Event) {
    e.preventDefault();
    if (!summary.trim()) return;
    const review = addDays(effective, SETTLE_DAYS + REVIEW_WINDOW);
    const c = await repos.changes.add({
      child_id: child!.id,
      type,
      medicine_id: medicineId ?? data.medicines.find((m) => summary.toLowerCase().includes(m.generic_name.toLowerCase()))?.id ?? null,
      summary: summary.trim(),
      reason: reason.trim(),
      decided_by: decided.trim(),
      effective_on: effective,
      review_on: review,
      outcome: 'undecided',
    });
    ctx.toast(fmt(C.saved, { date: shortDate(`${review}T12:00:00`, lang) }));
    go(`/change/${c.id}`, true);
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main">
        <form class="stack" style="--stack-gap: 16px" onSubmit={save}>
          <ScreenHeader title={C.add} backTo="/insights" />
          <fieldset class="field">
            <legend class="field__label">{C.type}</legend>
            <div class="chip-group" role="radiogroup" aria-label={C.type}>
              {CHANGE_TYPES.map((k) => (
                <Chip key={k} mode="single" on={type === k} onClick={() => setType(k)}>
                  {C.types[k]}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Field id="ch-summary" label={C.summary}>
            <TextInput id="ch-summary" value={summary} onValue={setSummary} placeholder={C.summaryPlaceholder} required maxLength={140} data-autofocus />
          </Field>
          <Field id="ch-reason" label={C.reason} optional>
            <TextInput id="ch-reason" value={reason} onValue={setReason} maxLength={200} />
          </Field>
          <Field id="ch-decided" label={C.decidedBy} optional>
            <TextInput id="ch-decided" value={decided} onValue={setDecided} maxLength={80} />
          </Field>
          <Field id="ch-from" label={C.effective}>
            <TextInput id="ch-from" type="date" value={effective} onValue={setEffective} required />
          </Field>
          <p class="t-caption-13 muted">{fmt(C.reviewOn, {})}: {shortDate(`${addDays(effective, SETTLE_DAYS + REVIEW_WINDOW)}T12:00:00`, lang)}</p>
          <button type="submit" class="btn btn--primary btn--block">
            {t.common.save}
          </button>
          <p class="t-caption-13 muted">{t.medicines.boundary}</p>
        </form>
      </main>
    </div>
  );
}

/** Change review (2523:256): 14 days before and after, counts, coverage, overlaps flagged. */
export function ChangeReview({ id }: { id: string }) {
  const ctx = useApp();
  const { t, lang, repos } = ctx;
  const C = t.changes;
  const care = useCareData();
  const today = localDay();
  const change = care.changes.find((c) => c.id === id);
  const { events, tags, ready } = useEvents(change ? addDays(change.effective_on, -20) : today, today);
  if (!care.ready || !ready) return null;
  if (!change) {
    return (
      <div class="app-screen">
        <main class="column app-main">
          <ScreenHeader title={C.title} backTo="/insights" />
        </main>
      </div>
    );
  }
  const rows = buildDailyTable(events, tags, addDays(change.effective_on, -20), today);
  const r = reviewChange(change, rows, care.changes, today);
  const n = (v: number) => formatNumber(v, lang);
  const of = (a: number, b: number) => fmt(C.ofDays, { n: a, d: b }, lang);
  const metric = (label: string, f: (s: WindowStats) => string | null) => {
    const b = f(r.before);
    const a = f(r.after);
    if (b === null && a === null) return null;
    return (
      <tr key={label}>
        <th scope="row">{label}</th>
        <td>{b ?? '–'}</td>
        <td class="rv-after">{a ?? '–'}</td>
      </tr>
    );
  };
  const enough = r.before.covered > 0 && r.after.covered > 0;
  const status = r.ready ? C.ready : r.afterSoFar > 0 ? fmt(C.learning, { n: r.afterSoFar }, lang) : fmt(C.reviewDue, { n: 0 }, lang);

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 14px">
        <a class="back-link" href="#/insights">
          <Icon name="chevron-left" size={18} />
          {C.title}
        </a>
        <header class="stack" style="--stack-gap: 6px">
          <Overline tone="medicine">{status}</Overline>
          <h1 class="screen-title">{change.summary}</h1>
          <p class="t-caption-13 muted">
            {[
              change.decided_by ? fmt(C.decided, { who: change.decided_by, date: shortDate(`${change.effective_on}T12:00:00`, lang) }) : shortDate(`${change.effective_on}T12:00:00`, lang),
              change.reason ? fmt(C.reasonLine, { reason: change.reason }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </header>
        <section class="card">
          {enough ? (
            <table class="rv-table">
              <thead>
                <tr>
                  <td />
                  <th scope="col">{C.before}</th>
                  <th scope="col">{C.after}</th>
                </tr>
              </thead>
              <tbody>
                {metric(C.daysHard, (s) => (s.covered ? of(s.hardDays, s.covered) : null))}
                {metric(C.sleep, (s) => (s.sleepAvgMin === null ? null : duration(s.sleepAvgMin, ctx)))}
                {metric(C.wakings, (s) => (s.wakingsAvg === null ? null : fmt(C.perNight, { n: s.wakingsAvg }, lang)))}
                {metric(C.dosesOnTime, (s) => (s.onTime + s.late + s.missed ? of(s.onTime, s.onTime + s.late + s.missed) : null))}
                {metric(C.winDays, (s) => (s.covered ? of(s.winDays, s.covered) : null))}
              </tbody>
            </table>
          ) : (
            <p class="t-body-14 muted">{C.notEnough}</p>
          )}
          <p class="t-caption-13 muted rv-based">{fmt(C.basedOn, { before: n(r.before.covered), after: n(r.after.covered) })}</p>
        </section>
        {r.overlaps.length > 0 ? (
          r.overlaps.map((o) => (
            <section class="nudge tone-marigold" key={o.id}>
              <p class="t-body-strong-15">{C.overlapTitle}</p>
              <p class="t-body-14">{fmt(C.overlapBody, { change: o.summary, date: shortDate(`${o.effective_on}T12:00:00`, lang) })}</p>
            </section>
          ))
        ) : (
          <p class="t-caption-13 muted">{C.noOverlap}</p>
        )}
        <section class="stack" style="--stack-gap: 10px">
          <h2 class="t-heading-17">{C.whatNext}</h2>
          <div class="chip-group" role="radiogroup" aria-label={C.whatNext}>
            {(['kept', 'changed', 'stopped', 'undecided'] as Change['outcome'][]).map((k) => (
              <Chip key={k} mode="single" on={change.outcome === k} onClick={() => void repos.changes.update(change.id, { outcome: k })}>
                {C.outcomes[k]}
              </Chip>
            ))}
          </div>
          <p class="t-caption-13 muted">{C.addToVisit}</p>
        </section>
        <p class="t-caption-13 muted">{t.insights.boundary}</p>
      </main>
    </div>
  );
}

export function changeStatus(c: Change, today: string, t: ReturnType<typeof useApp>['t'], lang: 'en' | 'bn'): string {
  const after = addDays(c.effective_on, SETTLE_DAYS);
  const soFar = Math.max(0, Math.min(REVIEW_WINDOW, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${after}T12:00:00`).getTime()) / 86_400_000) + 1));
  if (soFar >= REVIEW_WINDOW) return c.outcome === 'undecided' ? t.changes.ready : fmt(t.changes.outcome, { outcome: t.changes.outcomes[c.outcome] });
  return fmt(t.changes.learning, { n: soFar }, lang);
}
