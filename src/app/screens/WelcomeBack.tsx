import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { useChildData, useEvents } from '../data';
import { useLive } from '../live';
import { TextInput } from '../ui';
import { Chip } from '../../components/Chip';
import { Overline } from '../../components/Overline';
import { fmt } from '../../i18n';
import { addDays, dayOf, daysBetween, isoWithOffset, localDay } from '../../lib/time';
import { go } from '../router';
import { REVIEW_WINDOW, SETTLE_DAYS } from '../../domain/daily';
import type { DoseData } from '../../data/types';

/** Welcome back (2530:411): three yes/no questions after a gap, never a backlog to fill. */
export function WelcomeBack() {
  const ctx = useApp();
  const { t, child, repos, lang } = ctx;
  const W = t.welcome;
  const data = useChildData();
  const today = localDay();
  const away = useLive(() => repos.settings.get<string | null>('awaySince', null), [], null);
  const since = away ? dayOf(away) : addDays(today, -7);
  const gap = Math.max(7, daysBetween(since, today));
  const { events } = useEvents(since, today);
  const [med, setMed] = useState<boolean | null>(null);
  const [ill, setIll] = useState<boolean | null>(null);
  const [routine, setRoutine] = useState<boolean | null>(null);
  const [medText, setMedText] = useState('');
  const [routineText, setRoutineText] = useState('');
  const [routineSince, setRoutineSince] = useState(addDays(today, -Math.min(gap, 10)));
  const name = child!.name;

  const byNoter = new Map<string, number>();
  for (const e of events) if (e.noted_by) byNoter.set(e.noted_by, (byNoter.get(e.noted_by) ?? 0) + 1);
  const doseLines = data.medicines
    .filter((m) => m.active)
    .map((m) => {
      const days = new Set(events.filter((e) => e.kind === 'dose' && (e.data as unknown as DoseData).medicine_id === m.id).map((e) => dayOf(e.started_at))).size;
      return days ? fmt(W.awayDoses, { medicine: m.generic_name, n: days, days: gap }, lang) : '';
    })
    .filter(Boolean);
  const lines = [...[...byNoter.entries()].map(([who, n]) => fmt(W.awayNoted, { name: who, n }, lang)), ...doseLines];

  async function done() {
    const add = async (type: 'dose_change' | 'routine', summary: string, on: string) =>
      repos.changes.add({ child_id: child!.id, type, medicine_id: null, summary, reason: '', decided_by: '', effective_on: on, review_on: addDays(on, SETTLE_DAYS + REVIEW_WINDOW), outcome: 'undecided' });
    if (med && medText.trim()) await add('dose_change', medText.trim(), addDays(today, -Math.min(gap, 7)));
    if (routine && routineText.trim()) await add('routine', routineText.trim(), routineSince);
    if (ill)
      await repos.events.add({ child_id: child!.id, kind: 'health', started_at: isoWithOffset(), ended_at: null, size: null, place: null, data: { symptom: W.illNote }, note: '', noted_by: ctx.me || null, source: 'check_in' });
    await repos.settings.set('awaySince', null);
    go('/today', true);
  }

  const yn = (v: boolean | null, set: (b: boolean) => void, label: string) => (
    <div class="chip-group" role="radiogroup" aria-label={label}>
      <Chip mode="single" on={v === false} onClick={() => set(false)}>
        {W.no}
      </Chip>
      <Chip mode="single" on={v === true} onClick={() => set(true)}>
        {W.yes}
      </Chip>
    </div>
  );

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 12px">
        <header class="stack" style="--stack-gap: 6px; padding-top: 16px">
          <h1 class="screen-title">{W.title}</h1>
          <p class="t-body-15 muted">{fmt(W.body, { n: gap }, lang)}</p>
        </header>
        <section class="card stack tone-medicine" style="--stack-gap: 10px">
          <Overline tone="medicine" as="h2">
            {W.medicine}
          </Overline>
          {yn(med, setMed, W.medicine)}
          {med && <TextInput aria-label={W.what} value={medText} onValue={setMedText} placeholder={t.changes.summaryPlaceholder} maxLength={140} />}
        </section>
        <section class="card stack" style="--stack-gap: 10px">
          <Overline tone="hard-moment" as="h2">
            {fmt(W.ill, { name })}
          </Overline>
          {yn(ill, setIll, fmt(W.ill, { name }))}
        </section>
        <section class="card stack" style="--stack-gap: 10px">
          <Overline tone="neutral" as="h2">
            {W.routine}
          </Overline>
          {yn(routine, setRoutine, W.routine)}
          {routine && (
            <div class="empty-note stack" style="--stack-gap: 8px">
              <TextInput aria-label={W.what} value={routineText} onValue={setRoutineText} placeholder={W.whatPlaceholder} maxLength={140} />
              <label class="t-caption-13">
                {W.since}{' '}
                <input type="date" class="input input--time" value={routineSince} onInput={(e) => setRoutineSince((e.currentTarget as HTMLInputElement).value)} />
              </label>
            </div>
          )}
        </section>
        <section class="nudge tone-win">
          <Overline tone="win" as="h2">
            {W.away}
          </Overline>
          {lines.length ? lines.map((l) => <p class="t-body-14" key={l}>{l}</p>) : <p class="t-body-14">{W.awayNone}</p>}
        </section>
        <button type="button" class="btn btn--primary btn--block" onClick={() => void done()}>
          {W.done}
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          onClick={async () => {
            await repos.settings.set('awaySince', null);
            go('/today', true);
          }}
        >
          {W.skip}
        </button>
      </main>
    </div>
  );
}
