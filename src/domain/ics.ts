import type { Medicine, MedicineSchedule } from '../data/types';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1), counting UTF-8 bytes so Bangla stays intact. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export interface IcsOptions {
  timeZone: string;
  now?: Date;
  /** Minutes before the dose for the alarm. */
  alarmBefore?: number;
  title: (m: Medicine, s: MedicineSchedule) => string;
  description?: (m: Medicine, s: MedicineSchedule) => string;
}

/** A calendar file with one repeating event per dose time, each with an alarm. */
export function medicineCalendar(items: { medicine: Medicine; schedules: MedicineSchedule[] }[], startDay: string, opts: IcsOptions): string {
  const now = opts.now ?? new Date();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dayline//Medicine reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Dayline'];
  for (const { medicine, schedules } of items) {
    for (const s of schedules.filter((x) => !x.deleted_at)) {
      const from = s.starts_on && s.starts_on > startDay ? s.starts_on : startDay;
      for (const time of s.times) {
        const [h, m] = time.split(':');
        const rrule = s.days && s.days.length < 7 ? `FREQ=WEEKLY;BYDAY=${s.days.map((d) => BYDAY[d]).join(',')}` : 'FREQ=DAILY';
        const until = s.ends_on ? `;UNTIL=${s.ends_on.replace(/-/g, '')}T235959` : '';
        lines.push(
          'BEGIN:VEVENT',
          `UID:${s.id}-${time.replace(':', '')}@dayline`,
          `DTSTAMP:${stamp(now)}`,
          `DTSTART;TZID=${opts.timeZone}:${from.replace(/-/g, '')}T${h}${m}00`,
          'DURATION:PT5M',
          `RRULE:${rrule}${until}`,
          `SUMMARY:${escapeText(opts.title(medicine, s))}`,
          ...(opts.description ? [`DESCRIPTION:${escapeText(opts.description(medicine, s))}`] : []),
          'TRANSP:TRANSPARENT',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapeText(opts.title(medicine, s))}`,
          `TRIGGER:-PT${opts.alarmBefore ?? 0}M`,
          'END:VALARM',
          'END:VEVENT',
        );
      }
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
