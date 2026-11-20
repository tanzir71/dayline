import { describe, it, expect } from 'vitest';
import { plannedDoses, nextDose, doseStatusAt, daysLeft, isLow, dosesPerDay, scheduleActiveOn } from './schedule';
import { medicineCalendar, fold } from './ics';
import type { DayEvent, Medicine, MedicineSchedule, Stock } from '../data/types';

const row = { created_at: '', updated_at: '', deleted_at: null };
const mel: Medicine = { ...row, id: 'm1', child_id: 'c1', generic_name: 'Melatonin', brand_name: '', form: 'tablet', strength_text: '3 mg', prescriber_id: null, label_key: null, active: true, notes: '' };
const ris: Medicine = { ...mel, id: 'm2', generic_name: 'Risperidone' };
const sMel: MedicineSchedule = { ...row, id: 's1', medicine_id: 'm1', times: ['19:00'], days: null, amount_text: '1 tablet', with_food: false, starts_on: null, ends_on: null };
const sRis: MedicineSchedule = { ...sMel, id: 's2', medicine_id: 'm2', times: ['07:30'] };
const dose = (medicine_id: string, time: string, at: string): DayEvent => ({
  ...row, id: `e-${medicine_id}-${time}`, child_id: 'c1', kind: 'dose', started_at: at, ended_at: null, size: null, place: null,
  data: { medicine_id, schedule_time: time, status: 'given', amount_text: '1 tablet' }, note: '', noted_by: 'Amma', source: 'tap',
});

describe('dose schedule', () => {
  it('lists the day in time order and matches doses already given', () => {
    const p = plannedDoses('2026-11-20', [mel, ris], [sMel, sRis], [dose('m2', '07:30', '2026-11-20T07:50:00+06:00')]);
    expect(p.map((x) => `${x.time} ${x.medicine.generic_name} ${x.event ? 'given' : 'open'}`)).toEqual(['07:30 Risperidone given', '19:00 Melatonin open']);
  });
  it('next dose is the earliest unmarked one still relevant', () => {
    const p = plannedDoses('2026-11-20', [mel, ris], [sMel, sRis], []);
    expect(nextDose(p, 8 * 60)?.medicine.generic_name).toBe('Risperidone');
    expect(nextDose(p, 12 * 60)?.medicine.generic_name).toBe('Melatonin');
    expect(nextDose(p, 23 * 60 + 30)).toBeNull();
  });
  it('a dose more than 30 minutes after its time is late', () => {
    expect(doseStatusAt('07:30', '2026-11-20T07:55:00+06:00')).toBe('given');
    expect(doseStatusAt('07:30', '2026-11-20T08:10:00+06:00')).toBe('late');
  });
  it('respects weekdays and start/end dates', () => {
    const weekdays = { ...sMel, days: [1, 2, 3, 4, 5] };
    expect(scheduleActiveOn(weekdays, '2026-11-20')).toBe(true); // Friday
    expect(scheduleActiveOn(weekdays, '2026-11-22')).toBe(false); // Sunday
    expect(scheduleActiveOn({ ...sMel, starts_on: '2026-12-01' }, '2026-11-20')).toBe(false);
  });
  it('skips stopped medicines', () => {
    expect(plannedDoses('2026-11-20', [{ ...mel, active: false }], [sMel], [])).toEqual([]);
  });
});

describe('refills', () => {
  const stock: Stock = { ...row, id: 'k1', medicine_id: 'm1', units_left: 10, units_per_dose: 1, warn_at_days: 7 };
  it('estimates days left from doses per day', () => {
    expect(dosesPerDay([{ ...sMel, times: ['08:00', '20:00'] }])).toBe(2);
    expect(daysLeft(stock, [{ ...sMel, times: ['08:00', '20:00'] }])).toBe(5);
    expect(isLow(stock, [{ ...sMel, times: ['08:00', '20:00'] }])).toBe(true);
    expect(isLow(stock, [sMel])).toBe(false);
  });
  it('no stock count means no warning', () => {
    expect(daysLeft(undefined, [sMel])).toBeNull();
  });
});

describe('calendar export', () => {
  const ics = medicineCalendar([{ medicine: mel, schedules: [sMel, { ...sRis, medicine_id: 'm1', id: 's3', days: [1, 3] }] }], '2026-11-20', {
    timeZone: 'Asia/Dhaka',
    now: new Date('2026-11-20T10:00:00Z'),
    alarmBefore: 5,
    title: (m, s) => `${m.generic_name}, ${s.amount_text}`,
  });
  it('has one repeating event per time with an alarm', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;TZID=Asia/Dhaka:20261120T190000');
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE');
    expect(ics).toContain('TRIGGER:-PT5M');
    expect(ics).toContain('SUMMARY:Melatonin\\, 1 tablet');
    const semi = medicineCalendar([{ medicine: mel, schedules: [sMel] }], '2026-11-20', { timeZone: 'Asia/Dhaka', title: () => 'A; B' });
    expect(semi).toContain('SUMMARY:A\\; B');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('folds long lines without splitting Bangla characters', () => {
    const long = 'SUMMARY:' + 'মেলাটোনিন '.repeat(12);
    const folded = fold(long);
    for (const line of folded.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n ').join('')).toBe(long);
  });
});
