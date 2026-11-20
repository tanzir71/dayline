import { useApp } from '../context';
import { useCareData, useChildData, useEvents } from '../data';
import { ScreenHeader } from '../ui';
import { ChipLabel } from '../../components/Chip';
import { Overline } from '../../components/Overline';
import { fmt } from '../../i18n';
import { addDays, dayOf, localDay } from '../../lib/time';
import { labelFor, SYMPTOMS } from '../../domain/labels';
import { hhmmLabel, shortDate } from '../format';
import type { DoseData } from '../../data/types';

const ymd = (s: string) => (/^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);

/** Medicine page (2530:650): the personal card, then official label sections with source and date. */
export function MedicineInfo({ id }: { id: string }) {
  const ctx = useApp();
  const { t, lang, child } = ctx;
  const M = t.medicineInfo;
  const data = useChildData();
  const care = useCareData();
  const today = localDay();
  const { events } = useEvents(addDays(today, -29), today);
  const med = data.medicines.find((m) => m.id === id);
  if (!data.ready) return null;
  if (!med) {
    return (
      <div class="app-screen">
        <main class="column app-main">
          <ScreenHeader title={t.medicines.title} backTo="/child/medicines" />
        </main>
      </div>
    );
  }
  const name = child!.name;
  const sched = data.schedules.find((s) => s.medicine_id === med.id);
  const label = labelFor(med, ctx.labels);
  const given = new Set(
    events.filter((e) => e.kind === 'dose' && (e.data as unknown as DoseData).medicine_id === med.id && ['given', 'late'].includes((e.data as unknown as DoseData).status)).map((e) => dayOf(e.started_at)),
  ).size;
  const start = care.changes.find((c) => c.medicine_id === med.id && c.type === 'medicine_start')?.effective_on ?? sched?.starts_on ?? dayOf(med.created_at);
  const prescriber = care.prescribers.find((p) => p.id === med.prescriber_id)?.name;

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 14px">
        <ScreenHeader title={med.generic_name} backTo="/child/medicines" />
        <section class="dose-card med-profile">
          <div class="dose-card__text">
            <p class="t-caption-13">{fmt(M.inProfile, { name })}</p>
            <p class="t-body-strong-15">
              {[fmt(M.since, { date: shortDate(`${start}T12:00:00`, lang) }), prescriber, sched?.times.map((x) => hhmmLabel(x, lang)).join(', ')].filter(Boolean).join(' · ')}
            </p>
            <p class="t-caption-13 muted">{fmt(t.medicines.givenLast30, { n: given }, lang)}</p>
          </div>
          <a class="btn btn--secondary btn--sm" href={`#/child/medicines/${med.id}`}>
            {M.edit}
          </a>
        </section>
        {label ? (
          <>
            <Overline tone="medicine">{M.fromLabel}</Overline>
            {label.boxed && <p class="nudge tone-hard-moment t-body-14">{M.boxed}</p>}
            <section class="stack" style="--stack-gap: 6px">
              <h2 class="t-heading-17">{M.what}</h2>
              <blockquote class="label-quote" lang="en">
                {label.indications}
              </blockquote>
              {lang !== 'en' && <p class="t-caption-13 muted">{M.englishOnly}</p>}
            </section>
            <section class="stack" style="--stack-gap: 8px">
              <h2 class="t-heading-17">{M.side}</h2>
              <div class="chip-group">
                {label.terms.map((k) => (
                  <ChipLabel key={k}>{SYMPTOMS.find((s) => s.key === k)?.[lang] ?? k}</ChipLabel>
                ))}
              </div>
            </section>
            <section class="stack" style="--stack-gap: 6px">
              <h2 class="t-heading-17">{M.ask}</h2>
              <ul class="dots">
                {M.askList.map((q) => (
                  <li key={q}>{fmt(q, { name })}</li>
                ))}
              </ul>
            </section>
            <p class="t-caption-13 muted">
              {fmt(M.source, { source: label.source, effective: shortDate(`${ymd(label.effective_time)}T12:00:00`, lang), fetched: shortDate(`${label.fetched_at}T12:00:00`, lang) })}{' '}
              <a href={label.dailymed_url}>{M.readFull}</a>
            </p>
          </>
        ) : (
          <p class="empty-note t-body-14">{M.noLabel}</p>
        )}
        <p class="t-caption-13 muted">{t.medicines.boundary}</p>
      </main>
    </div>
  );
}
