import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useChildData, useEvents } from '../data';
import { useLive } from '../live';
import { Sheet, TextInput, TextArea } from '../ui';
import { Chip } from '../../components/Chip';
import { fmt } from '../../i18n';
import { EVENT_KINDS, type DayEvent, type DoseStatus, type EventKind } from '../../data/types';
import { isoWithOffset, localDay, addDays, dayOf } from '../../lib/time';
import { plannedDoses, nextDose, doseStatusAt } from '../../domain/schedule';
import { timeLabel, hardWord } from '../format';
import { markDose, rememberNoter, saveMoment } from '../actions';
import { SYMPTOMS } from '../../domain/labels';

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
  eventId = null,
}: {
  onClose: () => void;
  initialKind: string;
  medicineId: string | null;
  scheduleTime: string | null;
  /** Fix an entry that is already on the day line (from Speak's Saved sheet). */
  eventId?: string | null;
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
  const [symptomKey, setSymptomKey] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [notedBy, setNotedBy] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<DayEvent | null>(null);

  // Editing: fill the form from the saved entry.
  useEffect(() => {
    if (!eventId) return;
    void (async () => {
      const e = await repos.events.get(eventId);
      if (!e) return;
      const tags = await repos.events.tags([e.id]);
      const d = e.data as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === 'string' ? v : null);
      setKind(e.kind);
      setTime(e.started_at.slice(11, 16));
      setSize(e.size);
      setPlace(e.place);
      setDur(typeof d.duration_bucket === 'number' ? d.duration_bucket : null);
      setBefore(tags.filter((x) => x.type === 'before').map((x) => x.tag));
      setHelped(tags.filter((x) => x.type === 'helped').map((x) => x.tag));
      setText(str(d.text) ?? str(d.summary) ?? '');
      if (e.kind === 'dose') {
        setMed(str(d.medicine_id));
        setSlot(str(d.schedule_time));
        setStatus((str(d.status) as DoseStatus | null) ?? 'given');
      }
      if (e.kind === 'sleep') {
        setBed(e.started_at.slice(11, 16));
        if (e.ended_at) setWake(e.ended_at.slice(11, 16));
        setQuality(str(d.quality));
        setWakings(Number(d.night_wakings ?? 0));
      }
      if (e.kind === 'food') {
        setMeal(str(d.meal) ?? 'snack');
        setAte(str(d.ate));
        setGut(str(d.gut));
      }
      if (e.kind === 'health') {
        setSymptom(str(d.symptom) ?? '');
        setSymptomKey(str(d.symptom_key));
        setValue(str(d.value) ?? '');
      }
      setNote(e.note);
      setNotedBy(e.noted_by);
      setEditing(e);
    })();
  }, [eventId]);

  // Default "noted by": the last name used, else the parent's own name.
  useEffect(() => {
    if (!eventId && notedBy === null && (lastNoter || me)) setNotedBy(lastNoter || me);
  }, [lastNoter, me]);

  // Dose: preselect the next due medicine.
  useEffect(() => {
    if ((eventId && !editing) || kind !== 'dose' || med || !data.medicines.length) return;
    const now = new Date();
    const n = nextDose(plannedDoses(today, data.medicines, data.schedules, events), now.getHours() * 60 + now.getMinutes());
    setMed(n?.medicine.id ?? data.medicines.find((m) => m.active)?.id ?? null);
    if (n) setSlot(n.time);
  }, [kind, data.medicines.length, editing]);

  const names = [...new Set([me, ...noters.map((n) => n.name)].filter(Boolean))];
  const playbookHelps = data.playbook.filter((p) => p.situation === 'hard_moment').map((p) => p.text);
  // An entry being fixed may carry a tag that isn't in today's list; keep it visible so it can be removed.
  const helpedOptions = [...new Set([...(playbookHelps.length ? playbookHelps : L.helpedFallback), ...helped])];

  async function moveStock(medicineId: string, sign: 1 | -1): Promise<(() => Promise<void>) | null> {
    const stock = (await repos.stock.where('medicine_id', medicineId))[0];
    if (!stock) return null;
    const before = stock.units_left;
    await repos.stock.update(stock.id, { units_left: Math.max(0, before + sign * (stock.units_per_dose || 1)) });
    return () => repos.stock.update(stock.id, { units_left: before });
  }

  /** Update a saved entry in place. Its source stays the same, so a voice entry stays "voice". */
  async function saveEdit(ev: DayEvent, at: Date, started: string, by: string | null): Promise<() => Promise<void>> {
    const oldData = ev.data as Record<string, unknown>;
    const oldTags = await repos.events.tags([ev.id]);
    const fields = { kind, started_at: started, ended_at: null as string | null, size: null as number | null, place: null as string | null, data: {} as Record<string, unknown>, note: note.trim(), noted_by: by };
    let tags: { type: 'before' | 'helped'; tag: string }[] = [];
    if (kind === 'dose') {
      const s = data.schedules.find((x) => x.medicine_id === med);
      const st = status === 'given' || status === 'late' ? doseStatusAt(slot, started) : status;
      fields.data = { medicine_id: med, schedule_time: slot, status: st, amount_text: ev.kind === 'dose' && oldData.medicine_id === med ? (oldData.amount_text ?? '') : (s?.amount_text ?? '') };
    } else if (kind === 'hard_moment') {
      const oldBucket = ev.kind === 'hard_moment' ? oldData.duration_bucket : null;
      const oldMinutes = ev.ended_at ? (new Date(ev.ended_at).getTime() - new Date(ev.started_at).getTime()) / 60000 : null;
      const minutes = dur === null ? null : dur === oldBucket && oldMinutes ? oldMinutes : DURATION_MIN[dur]!;
      fields.ended_at = minutes ? isoWithOffset(new Date(at.getTime() + minutes * 60000)) : null;
      fields.size = size;
      fields.place = place;
      fields.data = { parent_word: child?.hard_moment_word ?? null, duration_bucket: dur };
      tags = [...before.map((tag) => ({ type: 'before' as const, tag })), ...helped.map((tag) => ({ type: 'helped' as const, tag }))];
    } else if (kind === 'sleep') {
      const wakeDay = ev.kind === 'sleep' && ev.ended_at ? dayOf(ev.ended_at) : dayOf(ev.started_at);
      fields.started_at = isoWithOffset(new Date(`${bed > wake ? addDays(wakeDay, -1) : wakeDay}T${bed}:00`));
      fields.ended_at = isoWithOffset(new Date(`${wakeDay}T${wake}:00`));
      fields.data = { quality, night_wakings: wakings };
    } else if (kind === 'win') fields.data = { text: text.trim() };
    else if (kind === 'food') fields.data = { meal, ate, gut };
    else if (kind === 'school') fields.data = { summary: text.trim() };
    else if (kind === 'health') fields.data = { symptom: symptom.trim(), symptom_key: symptomKey, value: value.trim() };

    const counted = (k: EventKind, d: Record<string, unknown>) => (k === 'dose' && (d.status === 'given' || d.status === 'late') ? String(d.medicine_id) : null);
    const was = counted(ev.kind, oldData);
    const nowCounted = counted(kind, fields.data);
    const stockUndos: ((() => Promise<void>) | null)[] = [];
    if (was !== nowCounted) {
      if (was) stockUndos.push(await moveStock(was, 1));
      if (nowCounted) stockUndos.push(await moveStock(nowCounted, -1));
    }
    await repos.events.update(ev.id, fields);
    await repos.events.setTags(ev.id, tags);
    const oldHelped = oldTags.filter((x) => x.type === 'helped').map((x) => x.tag);
    const newHelped = tags.filter((x) => x.type === 'helped').map((x) => x.tag);
    const counts: { id: string; count: number }[] = [];
    for (const item of data.playbook) {
      const delta = Number(newHelped.includes(item.text)) - Number(oldHelped.includes(item.text));
      if (!delta) continue;
      counts.push({ id: item.id, count: item.helped_count });
      await repos.playbook.update(item.id, { helped_count: Math.max(0, item.helped_count + delta) });
    }
    return async () => {
      await repos.events.update(ev.id, { kind: ev.kind, started_at: ev.started_at, ended_at: ev.ended_at, size: ev.size, place: ev.place, data: ev.data, note: ev.note, noted_by: ev.noted_by });
      await repos.events.setTags(ev.id, oldTags.map((x) => ({ type: x.type, tag: x.tag })));
      for (const u of stockUndos.reverse()) await u?.();
      for (const c of counts) await repos.playbook.update(c.id, { helped_count: c.count });
    };
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    const at = new Date(`${editing ? dayOf(editing.started_at) : today}T${time}:00`);
    const started = editing && time === editing.started_at.slice(11, 16) ? editing.started_at : isoWithOffset(at);
    const by = notedBy?.trim() || null;
    if (by) await rememberNoter(ctx, by);
    let undo: (() => Promise<void>) | undefined;
    if (editing) {
      undo = await saveEdit(editing, at, started, by);
      ctx.toast(L.saved, () => void undo!());
      onClose();
      return;
    }
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
        kind === 'win' ? { text: text.trim() } : kind === 'food' ? { meal, ate, gut } : kind === 'school' ? { summary: text.trim() } : kind === 'health' ? { symptom: symptom.trim(), symptom_key: symptomKey, value: value.trim() } : {};
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
        <fieldset class="field">
          <legend class="field__label">{L.symptom}</legend>
          <div class="chip-group" role="radiogroup" aria-label={L.symptom}>
            {SYMPTOMS.map((sx) => (
              <Chip
                key={sx.key}
                mode="single"
                on={symptomKey === sx.key}
                onClick={() => {
                  const on = symptomKey === sx.key;
                  setSymptomKey(on ? null : sx.key);
                  setSymptom(on ? '' : sx[lang]);
                }}
              >
                {sx[lang]}
              </Chip>
            ))}
          </div>
        </fieldset>
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
