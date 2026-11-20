import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useChildData, useEvents } from '../data';
import { useLive } from '../live';
import { Sheet, TextInput, TextArea } from '../ui';
import { Chip } from '../../components/Chip';
import { fmt } from '../../i18n';
import { EVENT_KINDS, type DoseStatus, type EventKind } from '../../data/types';
import { isoWithOffset, localDay, addDays } from '../../lib/time';
import { plannedDoses, nextDose } from '../../domain/schedule';
import { timeLabel, hardWord } from '../format';
import { markDose, rememberNoter, saveMoment } from '../actions';

const DURATION_MIN = [3, 10, 22, 40];
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function toggle(set: string[], v: string): string[] {
  return set.includes(v) ? set.filter((x) => x !== v) : [...set, v];
}

/** Quick log (2523:76): pick a kind, add what you know, save. Nothing is required. */
export function QuickLog({
  onClose,
  initialKind,
  medicineId,
  scheduleTime,
}: {
  onClose: () => void;
  initialKind: string;
  medicineId: string | null;
  scheduleTime: string | null;
}) {
  const ctx = useApp();
  const { t, lang, child, repos, me } = ctx;
  const L = t.log;
  const data = useChildData();
  const today = localDay();
  const { events } = useEvents(today, today);
  const noters = useLive(() => repos.noters.all(), [], []);
  const lastNoter = useLive(() => repos.settings.get<string>('lastNoter', ''), [], '');

  const [kind, setKind] = useState<EventKind>((EVENT_KINDS as readonly string[]).includes(initialKind) ? (initialKind as EventKind) : 'hard_moment');
  const [time, setTime] = useState(hhmm(new Date()));
  const [editTime, setEditTime] = useState(false);
  const [size, setSize] = useState<number | null>(null);
  const [dur, setDur] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [before, setBefore] = useState<string[]>([]);
  const [helped, setHelped] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [med, setMed] = useState<string | null>(medicineId);
  const [slot, setSlot] = useState<string | null>(scheduleTime);
  const [status, setStatus] = useState<DoseStatus>('given');
  const [bed, setBed] = useState('21:00');
  const [wake, setWake] = useState(hhmm(new Date()).slice(0, 2) < '12' ? hhmm(new Date()) : '06:30');
  const [quality, setQuality] = useState<string | null>(null);
  const [wakings, setWakings] = useState(0);
  const [meal, setMeal] = useState<string>(() => {
    const h = new Date().getHours();
    return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack';
  });
  const [ate, setAte] = useState<string | null>(null);
  const [gut, setGut] = useState<string | null>(null);
  const [symptom, setSymptom] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [notedBy, setNotedBy] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  // Default "noted by": the last name used, else the parent's own name.
  useEffect(() => {
    if (notedBy === null && (lastNoter || me)) setNotedBy(lastNoter || me);
  }, [lastNoter, me]);

  // Dose: preselect the next due medicine.
  useEffect(() => {
    if (kind !== 'dose' || med || !data.medicines.length) return;
    const now = new Date();
    const n = nextDose(plannedDoses(today, data.medicines, data.schedules, events), now.getHours() * 60 + now.getMinutes());
    setMed(n?.medicine.id ?? data.medicines.find((m) => m.active)?.id ?? null);
    if (n) setSlot(n.time);
  }, [kind, data.medicines.length]);

  const names = [...new Set([me, ...noters.map((n) => n.name)].filter(Boolean))];
  const playbookHelps = data.playbook.filter((p) => p.situation === 'hard_moment').map((p) => p.text);
  const helpedOptions = playbookHelps.length ? playbookHelps : L.helpedFallback;

  async function save() {
    if (busy) return;
    setBusy(true);
    const at = new Date(`${today}T${time}:00`);
    const started = isoWithOffset(at);
    const by = notedBy?.trim() || null;
    if (by) await rememberNoter(ctx, by);
    let undo: (() => Promise<void>) | undefined;
    const base = { started_at: started, ended_at: null as string | null, size: null as number | null, place: null as string | null, note: note.trim(), noted_by: by, source: 'tap' as const };

    if (kind === 'dose') {
      const m = data.medicines.find((x) => x.id === med);
      if (!m) {
        setBusy(false);
        return;
      }
      const s = data.schedules.find((x) => x.medicine_id === m.id);
      const r = await markDose(ctx, m, slot, {
        status: status === 'given' ? undefined : status,
        at: started,
        amountText: s?.amount_text ?? '',
        notedBy: by,
        note: note.trim(),
      });
      undo = r.undo;
    } else if (kind === 'hard_moment') {
      const minutes = dur === null ? null : DURATION_MIN[dur]!;
      undo = await saveMoment(
        ctx,
        {
          ...base,
          kind,
          ended_at: minutes ? isoWithOffset(new Date(at.getTime() + minutes * 60000)) : null,
          size,
          place,
          data: { parent_word: child?.hard_moment_word ?? null, duration_bucket: dur },
        },
        [...before.map((tag) => ({ type: 'before' as const, tag })), ...helped.map((tag) => ({ type: 'helped' as const, tag }))],
      );
      for (const h of helped) {
        const item = data.playbook.find((p) => p.text === h);
        if (item) await repos.playbook.update(item.id, { helped_count: item.helped_count + 1 });
      }
    } else if (kind === 'sleep') {
      const bedDay = bed > wake ? addDays(today, -1) : today;
      undo = await saveMoment(
        ctx,
        {
          ...base,
          kind,
          started_at: isoWithOffset(new Date(`${bedDay}T${bed}:00`)),
          ended_at: isoWithOffset(new Date(`${today}T${wake}:00`)),
          data: { quality, night_wakings: wakings },
        },
        [],
      );
    } else {
      const d: Record<string, unknown> =
        kind === 'win' ? { text: text.trim() } : kind === 'food' ? { meal, ate, gut } : kind === 'school' ? { summary: text.trim() } : kind === 'health' ? { symptom: symptom.trim(), value: value.trim() } : {};
      undo = await saveMoment(ctx, { ...base, kind, data: d }, []);
    }
    ctx.toast(L.saved, undo ? () => void undo!() : undefined);
    onClose();
  }

  const canSave = kind === 'dose' ? !!med : kind === 'note' ? !!note.trim() : true;

  return (
    <Sheet
      title={L.title}
      onClose={onClose}
      class="quick-log"
      subtitle={
        <span class="quick-log__when">
          {fmt(L.nowFor, { time: timeLabel(new Date(`${today}T${time}:00`), lang), name: child!.name })}
          {!editTime ? (
            <button type="button" class="chip chip--default chip--small" onClick={() => setEditTime(true)}>
              {L.changeTime}
            </button>
          ) : (
            <input type="time" class="input input--time" aria-label={L.time} value={time} onInput={(e) => setTime((e.currentTarget as HTMLInputElement).value)} />
          )}
        </span>
      }
      footer={
        <button type="button" class="btn btn--primary btn--block" onClick={() => void save()} disabled={!canSave || busy}>
          {L.save}
        </button>
      }
    >
      <div class="chip-scroll" role="radiogroup" aria-label={L.kind}>
        {EVENT_KINDS.map((k) => (
          <Chip key={k} mode="single" on={kind === k} onClick={() => setKind(k)}>
            {k === 'hard_moment' ? hardWord(child, ctx) : t.kinds[k]}
          </Chip>
        ))}
      </div>

      {kind === 'hard_moment' && (
        <>
          <fieldset class="field">
            <legend class="field__label">{L.size}</legend>
            <div class="size-row" role="radiogroup" aria-label={L.size}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={size === n} class={`size ${size === n ? 'is-on' : ''}`} onClick={() => setSize(size === n ? null : n)}>
                  {new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-GB').format(n)}
                </button>
              ))}
            </div>
            <p class="size-scale t-caption-13 muted">
              <span>{L.sizeLow}</span>
              <span>{L.sizeHigh}</span>
            </p>
          </fieldset>
          <ChipField label={L.duration} options={L.durations} value={dur === null ? null : L.durations[dur]!} onPick={(v) => setDur(v === null ? null : L.durations.indexOf(v))} />
          <ChipField label={L.where} options={L.places} value={place} onPick={setPlace} />
          <MultiField label={L.before} hint={L.pickAny} options={L.befores} value={before} onToggle={(v) => setBefore(toggle(before, v))} />
          <MultiField
            label={L.helped}
            hint={playbookHelps.length ? fmt(L.fromPlaybook, { name: child!.name }) : undefined}
            options={helpedOptions}
            value={helped}
            onToggle={(v) => setHelped(toggle(helped, v))}
          />
        </>
      )}

      {kind === 'win' && (
        <div class="field">
          <label class="field__label" for="ql-win">
            {L.winText}
          </label>
          <TextInput id="ql-win" value={text} onValue={setText} placeholder={L.winPlaceholder} maxLength={140} />
        </div>
      )}

      {kind === 'dose' &&
        (data.medicines.length ? (
          <>
            <ChipField
              label={L.medicine}
              options={data.medicines.filter((m) => m.active).map((m) => m.generic_name)}
              value={data.medicines.find((m) => m.id === med)?.generic_name ?? null}
              onPick={(v) => {
                setMed(data.medicines.find((m) => m.generic_name === v)?.id ?? null);
                setSlot(null);
              }}
            />
            <ChipField
              label={L.status}
              options={Object.values(L.statuses)}
              value={L.statuses[status]}
              onPick={(v) => setStatus((Object.keys(L.statuses) as DoseStatus[]).find((k) => L.statuses[k] === v) ?? 'given')}
              required
            />
          </>
        ) : (
          <p class="empty-note t-body-14">
            {L.noMedicine}{' '}
            <a href="#/child/medicines/new">{t.today.addMedicine}</a>
          </p>
        ))}

      {kind === 'sleep' && (
        <>
          <div class="field-row">
            <div class="field">
              <label class="field__label" for="ql-bed">
                {L.sleepBed}
              </label>
              <input id="ql-bed" type="time" class="input" value={bed} onInput={(e) => setBed((e.currentTarget as HTMLInputElement).value)} />
            </div>
            <div class="field">
              <label class="field__label" for="ql-wake">
                {L.sleepWake}
              </label>
              <input id="ql-wake" type="time" class="input" value={wake} onInput={(e) => setWake((e.currentTarget as HTMLInputElement).value)} />
            </div>
          </div>
          <ChipField label={L.quality} options={Object.values(L.qualities)} value={quality ? L.qualities[quality as keyof typeof L.qualities] : null} onPick={(v) => setQuality(Object.entries(L.qualities).find(([, x]) => x === v)?.[0] ?? null)} />
          <div class="field">
            <span class="field__label" id="ql-wakings">
              {L.wakings}
            </span>
            <div class="stepper" role="group" aria-labelledby="ql-wakings">
              <button type="button" class="chip chip--default" onClick={() => setWakings(Math.max(0, wakings - 1))} aria-label="−">
                −
              </button>
              <output class="t-heading-17">{new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-GB').format(wakings)}</output>
              <button type="button" class="chip chip--default" onClick={() => setWakings(wakings + 1)} aria-label="+">
                +
              </button>
            </div>
          </div>
        </>
      )}

      {kind === 'food' && (
        <>
          <ChipField label={L.meal} options={Object.values(L.meals)} value={L.meals[meal as keyof typeof L.meals]} onPick={(v) => setMeal(Object.entries(L.meals).find(([, x]) => x === v)?.[0] ?? 'snack')} required />
          <ChipField label={L.ate} options={Object.values(L.ates)} value={ate ? L.ates[ate as keyof typeof L.ates] : null} onPick={(v) => setAte(Object.entries(L.ates).find(([, x]) => x === v)?.[0] ?? null)} />
          <ChipField label={L.gut} options={Object.values(L.guts)} value={gut ? L.guts[gut as keyof typeof L.guts] : null} onPick={(v) => setGut(Object.entries(L.guts).find(([, x]) => x === v)?.[0] ?? null)} />
        </>
      )}

      {kind === 'school' && (
        <div class="field">
          <label class="field__label" for="ql-school">
            {L.schoolSummary}
          </label>
          <TextInput id="ql-school" value={text} onValue={setText} placeholder={L.schoolPlaceholder} maxLength={200} />
        </div>
      )}

      {kind === 'health' && (
        <div class="field-row">
          <div class="field">
            <label class="field__label" for="ql-sym">
              {L.symptom}
            </label>
            <TextInput id="ql-sym" value={symptom} onValue={setSymptom} placeholder={L.symptomPlaceholder} maxLength={60} />
          </div>
          <div class="field">
            <label class="field__label" for="ql-val">
              {L.value}
            </label>
            <TextInput id="ql-val" value={value} onValue={setValue} maxLength={30} />
          </div>
        </div>
      )}

      <fieldset class="field">
        <legend class="field__label">{L.notedBy}</legend>
        <div class="chip-group" role="radiogroup" aria-label={L.notedBy}>
          {names.map((n) => (
            <Chip key={n} mode="single" on={notedBy === n} onClick={() => setNotedBy(notedBy === n ? null : n)}>
              {n}
            </Chip>
          ))}
          {!adding ? (
            <button type="button" class="chip chip--default" onClick={() => setAdding(true)}>
              + {L.addName}
            </button>
          ) : (
            <span class="add-name">
              <input
                class="input input--inline"
                aria-label={L.newName}
                value={newName}
                maxLength={30}
                onInput={(e) => setNewName((e.currentTarget as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    e.preventDefault();
                    setNotedBy(newName.trim());
                    setAdding(false);
                  }
                }}
              />
              <button
                type="button"
                class="chip chip--default"
                onClick={() => {
                  if (newName.trim()) setNotedBy(newName.trim());
                  setAdding(false);
                }}
              >
                {t.common.add}
              </button>
            </span>
          )}
          {notedBy && !names.includes(notedBy) && (
            <Chip mode="single" on onClick={() => setNotedBy(null)}>
              {notedBy}
            </Chip>
          )}
        </div>
      </fieldset>

      <div class="field">
        <label class="field__label" for="ql-note">
          {L.note}
        </label>
        <TextArea id="ql-note" rows={2} value={note} onValue={setNote} placeholder={L.notePlaceholder} maxLength={500} />
      </div>
    </Sheet>
  );
}

function ChipField({ label, options, value, onPick, required }: { label: string; options: string[]; value: string | null; onPick: (v: string | null) => void; required?: boolean }) {
  return (
    <fieldset class="field">
      <legend class="field__label">{label}</legend>
      <div class="chip-group" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <Chip key={o} mode="single" on={value === o} onClick={() => onPick(value === o && !required ? null : o)}>
            {o}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function MultiField({ label, hint, options, value, onToggle }: { label: string; hint?: string; options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <fieldset class="field">
      <legend class="field__label">
        {label}
        {hint && <span class="field__optional"> · {hint}</span>}
      </legend>
      <div class="chip-group">
        {options.map((o) => (
          <Chip key={o} on={value.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}
