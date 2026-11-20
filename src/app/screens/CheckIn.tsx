import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { useCareData } from '../data';
import { useLive } from '../live';
import { Chip } from '../../components/Chip';
import { Overline } from '../../components/Overline';
import { addDays, localDay } from '../../lib/time';
import type { Trend } from '../../data/types';

export interface CheckInSettings {
  day: number;
  time: string;
  on: boolean;
}

export const DEFAULT_CHECK_IN: CheckInSettings = { day: 5, time: '20:00', on: true };

/** The start of the check-in week that contains `now` (weeks start on the chosen day). */
export function weekStart(now: Date, day: number): string {
  const d = new Date(now);
  const back = (d.getDay() - day + 7) % 7;
  return addDays(localDay(d), -back);
}

/** The card is due once per week, from the chosen day and time, until answered or skipped. */
export function checkInDue(s: CheckInSettings, now: Date, answered: string[], skipped: string | null): string | null {
  if (!s.on) return null;
  const start = weekStart(now, s.day);
  if (answered.includes(start) || skipped === start) return null;
  const [h, m] = s.time.split(':').map(Number);
  const opens = new Date(`${start}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
  return now >= opens ? start : null;
}

/** Weekly check-in: three optional taps (sleep, mood, hard moments: less, same, more). */
export function CheckInCard() {
  const ctx = useApp();
  const { t, child, repos } = ctx;
  const K = t.checkIn;
  const care = useCareData();
  const settings = useLive(() => repos.settings.get<CheckInSettings>('checkIn', DEFAULT_CHECK_IN), [], DEFAULT_CHECK_IN);
  const skipped = useLive(() => repos.settings.get<string | null>('checkInSkipped', null), [], null);
  const [sleep, setSleep] = useState<Trend | null>(null);
  const [mood, setMood] = useState<Trend | null>(null);
  const [hard, setHard] = useState<Trend | null>(null);
  if (!care.ready) return null;
  const week = checkInDue(settings, new Date(), care.checkIns.map((c) => c.week_start), skipped);
  if (!week) return null;

  const row = (label: string, v: Trend | null, set: (x: Trend) => void, opts: Record<Trend, string>) => (
    <fieldset class="field">
      <legend class="t-body-strong-14">{label}</legend>
      <div class="chip-group" role="radiogroup" aria-label={label}>
        {(['less', 'same', 'more'] as Trend[]).map((k) => (
          <Chip key={k} mode="single" on={v === k} onClick={() => set(k)}>
            {opts[k]}
          </Chip>
        ))}
      </div>
    </fieldset>
  );

  return (
    <section class="card stack check-in" style="--stack-gap: 10px" aria-label={K.title}>
      <Overline tone="marigold">{K.title}</Overline>
      <p class="t-body-14 muted">{K.body}</p>
      {row(K.sleep, sleep, setSleep, K.opts)}
      {row(K.mood, mood, setMood, K.moodOpts)}
      {row(K.hard, hard, setHard, K.opts)}
      <div class="button-row">
        <button
          type="button"
          class="btn btn--primary btn--sm"
          disabled={!sleep && !mood && !hard}
          onClick={async () => {
            await repos.checkIns.add({ child_id: child!.id, week_start: week, sleep, mood, hard_moments: hard, note: '' });
            ctx.toast(K.saved);
          }}
        >
          {K.save}
        </button>
        <button type="button" class="btn btn--ghost btn--sm" onClick={() => void repos.settings.set('checkInSkipped', week)}>
          {K.skip}
        </button>
      </div>
    </section>
  );
}
