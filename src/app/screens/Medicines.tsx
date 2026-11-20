import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useChildData, useEvents } from '../data';
import { Field, ScreenHeader, TextInput } from '../ui';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { fmt } from '../../i18n';
import { addDays, localDay, dayOf } from '../../lib/time';
import { daysLeft } from '../../domain/schedule';
import { medicineCalendar } from '../../domain/ics';
import { hhmmLabel } from '../format';
import { deliverFile } from '../actions';
import { go } from '../router';
import type { DoseData, Medicine } from '../../data/types';

const FORMS = ['tablet', 'syrup', 'drops', 'capsule', 'other'] as const;

export function Medicines() {
  const ctx = useApp();
  const { t, lang } = ctx;
  const M = t.medicines;
  const data = useChildData();
  const today = localDay();
  const { events } = useEvents(addDays(today, -29), today);
  const [notif, setNotif] = useState(() => ('Notification' in window ? Notification.permission : 'denied'));

  const active = data.medicines.filter((m) => m.active);
  const stopped = data.medicines.filter((m) => !m.active);

  function givenDays(m: Medicine): number {
    return new Set(
      events
        .filter((e) => e.kind === 'dose' && (e.data as unknown as DoseData).medicine_id === m.id && ['given', 'late'].includes((e.data as unknown as DoseData).status))
        .map((e) => dayOf(e.started_at)),
    ).size;
  }

  async function exportIcs() {
    const items = active.map((m) => ({ medicine: m, schedules: data.schedules.filter((s) => s.medicine_id === m.id) }));
    const text = medicineCalendar(items, today, {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka',
      alarmBefore: 0,
      title: (m, s) => [m.generic_name, s.amount_text].filter(Boolean).join(', '),
      description: (m, s) => [m.notes, s.with_food ? M.withFood : '', M.boundary].filter(Boolean).join('\n'),
    });
    await deliverFile(new File([text], 'dayline-medicines.ics', { type: 'text/calendar' }), { share: false });
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 16px">
        <ScreenHeader title={M.title} backTo="/child" />
        {!data.medicines.length && <p class="empty-note t-body-14">{M.empty}</p>}
        <ul class="list-cards" role="list">
          {active.map((m) => {
            const scheds = data.schedules.filter((s) => s.medicine_id === m.id);
            const left = daysLeft(data.stocks.find((s) => s.medicine_id === m.id), scheds);
            const times = scheds.flatMap((s) => s.times).sort().map((x) => hhmmLabel(x, lang)).join(', ');
            return (
              <li key={m.id}>
                <a class="card med-card tone-medicine" href={ctx.flags.insights ? `#/child/medicines/${m.id}/info` : `#/child/medicines/${m.id}`}>
                  <span class="med-card__dot" aria-hidden="true" />
                  <span class="med-card__text">
                    <span class="t-body-strong-15">
                      {m.generic_name}
                      {m.strength_text ? ` · ${m.strength_text}` : ''}
                    </span>
                    <span class="t-caption-13 muted">{[times, scheds[0]?.amount_text].filter(Boolean).join(' · ')}</span>
                    <span class="t-caption-13 muted">
                      {[left !== null ? fmt(M.daysLeft, { n: left }, lang) : '', fmt(M.givenLast30, { n: givenDays(m) }, lang)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={18} />
                </a>
              </li>
            );
          })}
        </ul>
        <a class="btn btn--secondary btn--block" href="#/child/medicines/new">
          <Icon name="plus" size={20} />
          {M.add}
        </a>
        {active.length > 0 && (
          <section class="card stack" style="--stack-gap: 8px">
            <button type="button" class="btn btn--quiet btn--block" onClick={() => void exportIcs()}>
              <Icon name="download" size={20} />
              {M.ics}
            </button>
            <p class="t-caption-13 muted">{M.icsHint}</p>
            {'Notification' in window && notif !== 'granted' && notif !== 'denied' && (
              <button
                type="button"
                class="btn btn--ghost btn--block"
                onClick={async () => setNotif(await Notification.requestPermission())}
              >
                {M.notificationsOn}
              </button>
            )}
          </section>
        )}
        {stopped.length > 0 && (
          <section>
            <h2 class="t-heading-17">{M.stopped}</h2>
            <ul class="list-plain" role="list">
              {stopped.map((m) => (
                <li key={m.id}>
                  <a href={`#/child/medicines/${m.id}`}>{m.generic_name}</a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p class="t-caption-13 muted">{M.boundary}</p>
      </main>
    </div>
  );
}

export function MedicineEdit({ id }: { id: string }) {
  const ctx = useApp();
  const { t, child, repos, lang } = ctx;
  const M = t.medicines;
  const data = useChildData();
  const isNew = id === 'new';
  const med = isNew ? undefined : data.medicines.find((m) => m.id === id);
  const sched = med ? data.schedules.find((s) => s.medicine_id === med.id) : undefined;
  const stock = med ? data.stocks.find((s) => s.medicine_id === med.id) : undefined;

  const [loaded, setLoaded] = useState(isNew);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [strength, setStrength] = useState('');
  const [form, setForm] = useState<string>('tablet');
  const [notes, setNotes] = useState('');
  const [times, setTimes] = useState<string[]>(['08:00']);
  const [amount, setAmount] = useState('');
  const [withFood, setWithFood] = useState(false);
  const [days, setDays] = useState<number[] | null>(null);
  const [left, setLeft] = useState('');
  const [perDose, setPerDose] = useState('1');
  const [warnAt, setWarnAt] = useState('7');

  useEffect(() => {
    if (loaded || !med) return;
    setName(med.generic_name);
    setBrand(med.brand_name);
    setStrength(med.strength_text);
    setForm(med.form || 'tablet');
    setNotes(med.notes);
    if (sched) {
      setTimes(sched.times.length ? sched.times : ['08:00']);
      setAmount(sched.amount_text);
      setWithFood(sched.with_food);
      setDays(sched.days);
    }
    if (stock) {
      setLeft(String(stock.units_left));
      setPerDose(String(stock.units_per_dose));
      setWarnAt(String(stock.warn_at_days));
    }
    setLoaded(true);
  }, [med?.id, sched?.id, stock?.id]);

  async function save(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    const mv = { generic_name: name.trim(), brand_name: brand.trim(), strength_text: strength.trim(), form, notes: notes.trim() };
    const sv = { times: [...new Set(times.filter(Boolean))].sort(), days: days && days.length && days.length < 7 ? [...days].sort() : null, amount_text: amount.trim(), with_food: withFood };
    let medId = med?.id;
    if (med) await repos.medicines.update(med.id, mv);
    else medId = (await repos.medicines.add({ ...mv, child_id: child!.id, prescriber_id: null, label_key: null, active: true })).id;
    // Every medicine change gets a review date (M2).
    if (ctx.flags.insights) {
      const describe = (times: string[], amount: string) => [times.map((x) => hhmmLabel(x, lang)).join(', '), amount].filter(Boolean).join(' · ');
      const summary = !med
        ? fmt(t.changes.autoStart, { medicine: mv.generic_name })
        : sched && (sched.times.join() !== sv.times.join() || sched.amount_text !== sv.amount_text)
          ? fmt(t.changes.autoDose, { medicine: mv.generic_name, from: describe(sched.times, sched.amount_text), to: describe(sv.times, sv.amount_text) })
          : null;
      if (summary) await addChange(med ? 'dose_change' : 'medicine_start', summary, medId!);
    }
    if (sched) await repos.schedules.update(sched.id, sv);
    else await repos.schedules.add({ ...sv, medicine_id: medId!, starts_on: localDay(), ends_on: null });
    const units = left.trim() === '' ? null : Math.max(0, Number(left));
    if (units !== null && !Number.isNaN(units)) {
      const kv = { units_left: units, units_per_dose: Math.max(0.25, Number(perDose) || 1), warn_at_days: Math.max(0, Number(warnAt) || 7) };
      if (stock) await repos.stock.update(stock.id, kv);
      else await repos.stock.add({ ...kv, medicine_id: medId! });
    } else if (stock) await repos.stock.remove(stock.id);
    ctx.toast(t.common.saved);
    go('/child/medicines');
  }

  async function addChange(type: 'medicine_start' | 'dose_change' | 'medicine_stop', summary: string, medicineId: string) {
    const today = localDay();
    await repos.changes.add({ child_id: child!.id, type, medicine_id: medicineId, summary, reason: '', decided_by: '', effective_on: today, review_on: addDays(today, 17), outcome: 'undecided' });
  }

  async function setActive(active: boolean) {
    if (!med) return;
    await repos.medicines.update(med.id, { active });
    if (!active && ctx.flags.insights) await addChange('medicine_stop', fmt(t.changes.autoStop, { medicine: med.generic_name }), med.id);
    if (!active && sched) await repos.schedules.update(sched.id, { ends_on: localDay() });
    if (active && sched) await repos.schedules.update(sched.id, { ends_on: null });
    go('/child/medicines');
  }

  if (!isNew && !med) {
    return (
      <div class="app-screen">
        <main class="column app-main">
          <ScreenHeader title={M.edit} backTo="/child/medicines" />
        </main>
      </div>
    );
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main">
        <form class="stack" style="--stack-gap: 16px" onSubmit={save}>
          <ScreenHeader title={isNew ? M.add : M.edit} backTo="/child/medicines" />
          <Field id="md-name" label={M.generic} hint={M.genericHint}>
            <TextInput id="md-name" value={name} onValue={setName} required maxLength={60} data-autofocus />
          </Field>
          <div class="field-row">
            <Field id="md-brand" label={M.brand} optional>
              <TextInput id="md-brand" value={brand} onValue={setBrand} maxLength={60} />
            </Field>
            <Field id="md-strength" label={M.strength} optional>
              <TextInput id="md-strength" value={strength} onValue={setStrength} maxLength={30} />
            </Field>
          </div>
          <fieldset class="field">
            <legend class="field__label">{M.form}</legend>
            <div class="chip-group" role="radiogroup" aria-label={M.form}>
              {FORMS.map((f) => (
                <Chip key={f} mode="single" on={form === f} onClick={() => setForm(f)}>
                  {M.forms[f]}
                </Chip>
              ))}
            </div>
          </fieldset>
          <fieldset class="field">
            <legend class="field__label">{M.times}</legend>
            <div class="times">
              {times.map((tm, i) => (
                <span class="time-item" key={i}>
                  <input
                    type="time"
                    class="input input--time"
                    aria-label={`${M.times} ${i + 1}`}
                    value={tm}
                    onInput={(e) => setTimes(times.map((x, j) => (j === i ? (e.currentTarget as HTMLInputElement).value : x)))}
                  />
                  {times.length > 1 && (
                    <button type="button" class="icon-btn" aria-label={fmt(M.removeTime, { time: hhmmLabel(tm, lang) })} onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                      <Icon name="close" size={18} />
                    </button>
                  )}
                </span>
              ))}
              <button type="button" class="chip chip--default" onClick={() => setTimes([...times, '20:00'])}>
                + {M.addTime}
              </button>
            </div>
          </fieldset>
          <Field id="md-amount" label={M.amount} optional>
            <TextInput id="md-amount" value={amount} onValue={setAmount} placeholder={M.amountPlaceholder} maxLength={40} />
          </Field>
          <label class="check">
            <input type="checkbox" checked={withFood} onChange={(e) => setWithFood((e.currentTarget as HTMLInputElement).checked)} />
            <span>{M.withFood}</span>
          </label>
          <fieldset class="field">
            <legend class="field__label">{M.days}</legend>
            <div class="chip-group">
              <Chip mode="single" on={!days} onClick={() => setDays(null)}>
                {M.everyDay}
              </Chip>
              {M.weekdays.map((wd, i) => (
                <Chip key={wd} on={!!days?.includes(i)} onClick={() => setDays(days?.includes(i) ? days.filter((x) => x !== i) : [...(days ?? []), i])}>
                  {wd}
                </Chip>
              ))}
            </div>
          </fieldset>
          <Field id="md-notes" label={M.notes} optional>
            <TextInput id="md-notes" value={notes} onValue={setNotes} placeholder={M.notesPlaceholder} maxLength={120} />
          </Field>
          <fieldset class="field card">
            <legend class="field__label">{M.stock}</legend>
            <div class="field-row">
              <Field id="md-left" label={M.unitsLeft} optional>
                <TextInput id="md-left" type="number" inputMode="decimal" min="0" value={left} onValue={setLeft} />
              </Field>
              <Field id="md-per" label={M.perDose}>
                <TextInput id="md-per" type="number" inputMode="decimal" min="0.25" step="0.25" value={perDose} onValue={setPerDose} />
              </Field>
            </div>
            <Field id="md-warn" label={M.warnAt}>
              <TextInput id="md-warn" type="number" inputMode="numeric" min="0" value={warnAt} onValue={setWarnAt} />
            </Field>
          </fieldset>
          <button type="submit" class="btn btn--primary btn--block">
            {t.common.save}
          </button>
          {med && med.active && (
            <button type="button" class="btn btn--ghost" onClick={() => void setActive(false)}>
              {M.stop}
            </button>
          )}
          {med && !med.active && (
            <button type="button" class="btn btn--ghost" onClick={() => void setActive(true)}>
              {t.common.undo}
            </button>
          )}
          <p class="t-caption-13 muted">{M.boundary}</p>
        </form>
      </main>
    </div>
  );
}
