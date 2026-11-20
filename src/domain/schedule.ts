import type { DayEvent, DoseData, Medicine, MedicineSchedule, Stock } from '../data/types';
import { dayOf, hhmmToMinutes, minutesOf } from '../lib/time';

export interface PlannedDose {
  medicine: Medicine;
  schedule: MedicineSchedule;
  /** HH:MM */
  time: string;
  minutes: number;
  /** The dose event recorded for this slot, if any. */
  event: DayEvent | null;
}

/** Given more than this many minutes after the scheduled time counts as late. */
export const LATE_AFTER_MIN = 30;

export function weekday(day: string): number {
  return new Date(`${day}T12:00:00`).getDay();
}

export function scheduleActiveOn(s: MedicineSchedule, day: string): boolean {
  if (s.deleted_at) return false;
  if (s.starts_on && day < s.starts_on) return false;
  if (s.ends_on && day > s.ends_on) return false;
  return !s.days || s.days.includes(weekday(day));
}

/** Every scheduled dose for `day`, matched with the dose events already recorded. */
export function plannedDoses(day: string, medicines: Medicine[], schedules: MedicineSchedule[], events: DayEvent[]): PlannedDose[] {
  const doses = events.filter((e) => e.kind === 'dose' && !e.deleted_at && dayOf(e.started_at) === day);
  const used = new Set<string>();
  const out: PlannedDose[] = [];
  for (const m of medicines) {
    if (!m.active || m.deleted_at) continue;
    for (const s of schedules.filter((x) => x.medicine_id === m.id && scheduleActiveOn(x, day))) {
      for (const time of [...s.times].sort()) {
        const ev =
          doses.find((e) => {
            const d = e.data as unknown as DoseData;
            return !used.has(e.id) && d.medicine_id === m.id && d.schedule_time === time;
          }) ?? null;
        if (ev) used.add(ev.id);
        out.push({ medicine: m, schedule: s, time, minutes: hhmmToMinutes(time), event: ev });
      }
    }
  }
  return out.sort((a, b) => a.minutes - b.minutes || a.medicine.generic_name.localeCompare(b.medicine.generic_name));
}

/** The dose to show on Today: the earliest unmarked one that is overdue (up to 3 h) or still to come. */
export function nextDose(planned: PlannedDose[], nowMinutes: number): PlannedDose | null {
  const open = planned.filter((p) => !p.event);
  return open.find((p) => p.minutes >= nowMinutes - 180) ?? null;
}

export function isDue(p: PlannedDose, nowMinutes: number): boolean {
  return nowMinutes >= p.minutes - 15;
}

export function doseStatusAt(scheduled: string | null, givenAtIso: string): 'given' | 'late' {
  if (!scheduled) return 'given';
  return minutesOf(givenAtIso) - hhmmToMinutes(scheduled) > LATE_AFTER_MIN ? 'late' : 'given';
}

export function lateMinutes(scheduled: string | null, givenAtIso: string): number {
  if (!scheduled) return 0;
  return Math.max(0, minutesOf(givenAtIso) - hhmmToMinutes(scheduled));
}

/** Average doses per day across a medicine's active schedules. */
export function dosesPerDay(schedules: MedicineSchedule[]): number {
  return schedules
    .filter((s) => !s.deleted_at)
    .reduce((sum, s) => sum + s.times.length * (s.days ? s.days.length / 7 : 1), 0);
}

/** Whole days of medicine left, or null when there is no stock count. */
export function daysLeft(stock: Stock | undefined, schedules: MedicineSchedule[]): number | null {
  if (!stock || stock.deleted_at) return null;
  const perDay = dosesPerDay(schedules) * (stock.units_per_dose || 1);
  if (perDay <= 0) return null;
  return Math.floor(stock.units_left / perDay);
}

export function isLow(stock: Stock | undefined, schedules: MedicineSchedule[]): boolean {
  const left = daysLeft(stock, schedules);
  return left !== null && stock !== undefined && left <= stock.warn_at_days;
}
