import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import type { AppCtx } from '../app/context';
import { markDose } from '../app/actions';
import { hhmmLabel } from '../app/format';
import { go } from '../app/router';
import type { DoseData } from '../data/types';
import { plannedDoses } from '../domain/schedule';
import { fmt } from '../i18n';
import { addDays, atTime, dayOf, isoWithOffset, localDay } from '../lib/time';
import { PENDING_ACTION } from './is-native';

export const REMINDERS_ON = 'reminders.on';
const DAYS = 7;
const MAX_PENDING = 200;
const SNOOZE_MIN = 15;
const CHANNEL = 'doses';
const ACTION_TYPE = 'dose';

interface Extra {
  kind: 'dose';
  childId: string;
  medicineId: string;
  time: string;
  day: string;
  snooze?: boolean;
}

function idFor(key: string): number {
  let h = 7;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2_000_000_000) + 1;
}

const isOurs = (extra: unknown): extra is Extra => (extra as Extra | undefined)?.kind === 'dose';

/** The next 7 days of open doses for every child, as notifications. */
export async function planReminders(ctx: Pick<AppCtx, 'repos' | 't' | 'lang'>, now = new Date()): Promise<LocalNotificationSchema[]> {
  if (!(await ctx.repos.settings.get(REMINDERS_ON, false))) return [];
  const today = localDay(now);
  const last = addDays(today, DAYS - 1);
  const [children, allSchedules] = await Promise.all([ctx.repos.children.all(), ctx.repos.schedules.all()]);
  const out: LocalNotificationSchema[] = [];
  for (const child of children) {
    const medicines = await ctx.repos.medicines.where('child_id', child.id);
    const events = await ctx.repos.events.between(child.id, today, last);
    for (let i = 0; i < DAYS; i++) {
      const day = addDays(today, i);
      for (const p of plannedDoses(day, medicines, allSchedules, events)) {
        const at = atTime(day, p.time);
        if (p.event || at <= now) continue;
        const name = [p.medicine.generic_name, p.medicine.strength_text].filter(Boolean).join(' ');
        const extra: Extra = { kind: 'dose', childId: child.id, medicineId: p.medicine.id, time: p.time, day };
        out.push({
          id: idFor(`${child.id}|${p.medicine.id}|${day}|${p.time}`),
          title: fmt(ctx.t.voice.reminderTitle, { medicine: name, child: child.name }),
          body: [hhmmLabel(p.time, ctx.lang), p.schedule.amount_text, p.schedule.with_food ? ctx.t.medicines.withFood : ''].filter(Boolean).join(' · '),
          channelId: CHANNEL,
          actionTypeId: ACTION_TYPE,
          smallIcon: 'ic_stat_dayline',
          // Inexact on purpose: a few minutes late is fine, and it needs no exact-alarm permission.
          isExactNotification: false,
          schedule: { at, allowWhileIdle: true },
          extra,
        });
      }
    }
  }
  return out.sort((a, b) => a.schedule!.at!.getTime() - b.schedule!.at!.getTime()).slice(0, MAX_PENDING);
}

let queue: Promise<void> = Promise.resolve();
let lastKey = '';

/** Make the phone's pending reminders match the plan. Runs one at a time. */
export function applyReminders(wanted: LocalNotificationSchema[]): Promise<void> {
  const key = JSON.stringify(wanted.map((n) => [n.id, n.title, n.body, n.schedule?.at]));
  queue = queue
    .then(async () => {
      if (key === lastKey) return;
      if (wanted.length && (await LocalNotifications.checkPermissions()).display !== 'granted') return;
      const ids = new Set(wanted.map((n) => n.id));
      const pending = (await LocalNotifications.getPending()).notifications;
      const stale = pending.filter((n) => isOurs(n.extra) && !n.extra.snooze && !ids.has(n.id));
      if (stale.length) await LocalNotifications.cancel({ notifications: stale.map((n) => ({ id: n.id })) });
      if (wanted.length) await LocalNotifications.schedule({ notifications: wanted });
      lastKey = key;
    })
    .catch((e) => console.error(e));
  return queue;
}

export async function setupReminders(ctx: Pick<AppCtx, 't'>): Promise<void> {
  await LocalNotifications.createChannel({ id: CHANNEL, name: ctx.t.voice.reminders, importance: 4, visibility: 1 });
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE,
        actions: [
          { id: 'given', title: ctx.t.voice.actionGiven },
          { id: 'speak', title: ctx.t.voice.speak },
          { id: 'later', title: ctx.t.voice.actionLater },
        ],
      },
    ],
  });
}

/** Ask only when a parent acts: the first saved schedule, or turning reminders on. */
export async function enableReminders(ctx: Pick<AppCtx, 'repos'>): Promise<boolean> {
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions();
  const granted = perm.display === 'granted';
  await ctx.repos.settings.set(REMINDERS_ON, granted);
  return granted;
}

/** Called after a medicine schedule is saved. Asks once, for the first schedule. */
export async function afterScheduleSaved(ctx: Pick<AppCtx, 'repos'>): Promise<void> {
  const asked = await ctx.repos.settings.get<boolean | null>(REMINDERS_ON, null);
  if (asked === null) await enableReminders(ctx);
}

export async function handleReminderAction(ctx: AppCtx, action: { actionId: string; extra: unknown }): Promise<void> {
  const { actionId, extra } = action;
  if (!isOurs(extra)) return;
  if (extra.childId !== ctx.child?.id) ctx.setChild(extra.childId);
  if (actionId === 'speak') {
    go(`/today?sheet=speak&medicine=${extra.medicineId}`);
  } else if (actionId === 'later') {
    const pending = (await LocalNotifications.getPending()).notifications;
    const child = await ctx.repos.children.get(extra.childId);
    const medicine = await ctx.repos.medicines.get(extra.medicineId);
    if (!child || !medicine) return;
    const id = idFor(`${extra.childId}|${extra.medicineId}|${extra.day}|${extra.time}|later`);
    if (pending.some((n) => n.id === id)) await LocalNotifications.cancel({ notifications: [{ id }] });
    const name = [medicine.generic_name, medicine.strength_text].filter(Boolean).join(' ');
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: fmt(ctx.t.voice.reminderTitle, { medicine: name, child: child.name }),
          body: hhmmLabel(extra.time, ctx.lang),
          channelId: CHANNEL,
          actionTypeId: ACTION_TYPE,
          smallIcon: 'ic_stat_dayline',
          isExactNotification: false,
          schedule: { at: new Date(Date.now() + SNOOZE_MIN * 60_000), allowWhileIdle: true },
          extra: { ...extra, snooze: true },
        },
      ],
    });
  } else if (actionId === 'given') {
    const [child, medicine, schedules, events, me, lastNoter] = await Promise.all([
      ctx.repos.children.get(extra.childId),
      ctx.repos.medicines.get(extra.medicineId),
      ctx.repos.schedules.where('medicine_id', extra.medicineId),
      ctx.repos.events.forDay(extra.childId, extra.day),
      ctx.repos.settings.get('me', ''),
      ctx.repos.settings.get('lastNoter', ''),
    ]);
    if (!child || !medicine) return;
    const already = events.some((e) => {
      const d = e.data as unknown as DoseData;
      return e.kind === 'dose' && d.medicine_id === medicine.id && d.schedule_time === extra.time && dayOf(e.started_at) === extra.day;
    });
    if (already) return;
    const amount = schedules.find((s) => s.times.includes(extra.time))?.amount_text ?? '';
    const { undo } = await markDose({ repos: ctx.repos, child, me }, medicine, extra.time, {
      // Pressed after midnight, the dose still belongs to the day it was due.
      at: localDay() === extra.day ? isoWithOffset() : isoWithOffset(atTime(extra.day, extra.time)),
      amountText: amount,
      notedBy: lastNoter || me || null,
      source: 'schedule',
    });
    ctx.toast(fmt(ctx.t.events.doseGiven, { medicine: medicine.generic_name }), () => void undo());
  } else {
    go('/today');
  }
}

export function takePendingAction(): { actionId: string; extra: unknown } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ACTION);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_ACTION);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
