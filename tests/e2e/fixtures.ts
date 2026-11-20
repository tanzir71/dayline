import { writeFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { addDays, isoWithOffset, localDay } from '../../src/lib/time';

const row = (id: string) => ({ id, created_at: isoWithOffset(), updated_at: isoWithOffset(), deleted_at: null });
const at = (day: string, hhmm: string) => isoWithOffset(new Date(`${day}T${hhmm}:00`));

/**
 * A backup with seven weeks of history for one child: short nights before most hard moments,
 * a melatonin change with an overlapping school change, risperidone with sleepiness noted twice.
 */
export function historyBackup(opts: { lastOpenedDaysAgo?: number } = {}) {
  const today = localDay();
  const events: Record<string, unknown>[] = [];
  const tags: Record<string, unknown>[] = [];
  let n = 0;
  const ev = (kind: string, started: string, extra: Record<string, unknown> = {}) => {
    const id = `e${n++}`;
    events.push({ ...row(id), child_id: 'c1', kind, started_at: started, ended_at: null, size: null, place: null, data: {}, note: '', noted_by: 'Amma', source: 'tap', ...extra });
    return id;
  };
  for (let i = 40; i >= 1; i--) {
    const day = addDays(today, -i);
    const short = i % 4 === 0; // 10 short nights
    ev('sleep', at(addDays(day, -1), '21:00'), { ended_at: at(day, short ? '03:00' : '06:30'), data: { night_wakings: short ? 2 : 0 } });
    const hard = short ? i % 20 !== 0 : i % 5 === 1;
    if (hard) {
      const id = ev('hard_moment', at(day, '16:30'), { ended_at: at(day, '16:40'), data: { parent_word: null } });
      tags.push({ ...row(`t${id}`), event_id: id, type: 'before', tag: 'Transition' });
    }
    ev('dose', at(day, '07:40'), { data: { medicine_id: 'm1', schedule_time: '07:30', status: 'given', amount_text: '1 tablet' } });
  }
  ev('health', at(addDays(today, -6), '09:00'), { data: { symptom: 'Sleepiness', symptom_key: 'sleepiness', value: '' } });
  ev('health', at(addDays(today, -3), '09:00'), { data: { symptom: 'Sleepiness', symptom_key: 'sleepiness', value: '' } });

  const change = (id: string, summary: string, daysAgo: number, type: string, decided: string) => ({
    ...row(id), child_id: 'c1', type, medicine_id: null, summary, reason: 'taking over an hour to fall asleep', decided_by: decided,
    effective_on: addDays(today, -daysAgo), review_on: addDays(today, -daysAgo + 17), outcome: 'undecided',
  });
  const last = isoWithOffset(new Date(Date.now() - (opts.lastOpenedDaysAgo ?? 0) * 86_400_000));
  return {
    format: 'dayline-backup',
    version: 2,
    exported_at: isoWithOffset(),
    tables: {
      child: [{ ...row('c1'), name: 'Rafi', birth_month: '2019-04', language: 'en', photo: null, hard_moment_word: null }],
      profile_section: [],
      contact: [{ ...row('k1'), child_id: 'c1', name: 'Amma', role: 'parent', phone: '01700000000', notes: '' }],
      noter: [{ ...row('n1'), name: 'Amma', role: null }],
      prescriber: [{ ...row('p1'), child_id: 'c1', name: 'Dr. Rahman', specialty: 'Child psychiatrist', clinic: '', phone: '' }],
      medicine: [{ ...row('m1'), child_id: 'c1', generic_name: 'Risperidone', brand_name: '', form: 'tablet', strength_text: '0.5 mg', prescriber_id: 'p1', label_key: null, active: true, notes: '' }],
      medicine_schedule: [{ ...row('s1'), medicine_id: 'm1', times: ['07:30'], days: null, amount_text: '1 tablet', with_food: false, starts_on: addDays(today, -60), ends_on: null }],
      stock: [],
      event: events,
      event_tag: tags,
      playbook_item: [],
      share_record: [],
      visit: [{ ...row('v1'), child_id: 'c1', prescriber_id: 'p1', scheduled_at: at(addDays(today, 2), '10:30'), prep: null, questions: [], report_period_start: addDays(today, -42) }],
      change: [change('ch1', 'Melatonin moved from 8:30 to 7:00 pm', 20, 'dose_change', 'Dr. Sultana'), change('ch2', 'New lunch-to-class routine at school', 15, 'school', 'School')],
      check_in: [],
      insight_feedback: [],
      settings: [
        { key: 'currentChild', value: 'c1' },
        { key: 'me', value: 'Amma' },
        { key: 'firstUse', value: addDays(today, -60) },
        { key: 'lastOpened', value: last },
        { key: 'lastBackup', value: isoWithOffset() },
      ],
    },
  };
}

/** Restore a backup through Settings, the same way a parent would. */
export async function restore(page: Page, backup: object, path: string) {
  await writeFile(path, JSON.stringify(backup));
  page.on('dialog', (d) => void d.accept());
  await page.goto('app/#/settings');
  await page.locator('input[type=file]').setInputFiles(path);
  await page.getByText('Restored from the backup').waitFor();
  await page.waitForLoadState('load');
  await page.waitForTimeout(800);
}
