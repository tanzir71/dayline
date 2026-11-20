/** Local entities (one IndexedDB database per device; there is no server copy). */

export interface Row {
  id: string;
  created_at: string;
  updated_at: string;
  /** Soft delete: a mistaken delete can be undone and backups stay consistent. */
  deleted_at: string | null;
}

export type Lang = 'en' | 'bn';

export interface Child extends Row {
  name: string;
  birth_month: string | null; // YYYY-MM
  language: Lang;
  photo: Blob | null;
  hard_moment_word: string | null;
}

export const PROFILE_SECTIONS = ['communication', 'distress_signs', 'calms', 'avoid', 'food', 'sleep', 'other'] as const;
export type ProfileSectionKey = (typeof PROFILE_SECTIONS)[number];

export interface ProfileSection extends Row {
  child_id: string;
  section: ProfileSectionKey;
  body: string;
  sort: number;
}

export const CONTACT_ROLES = ['parent', 'grandparent', 'sitter', 'teacher', 'doctor', 'therapist', 'other'] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export interface Contact extends Row {
  child_id: string;
  name: string;
  role: ContactRole;
  phone: string;
  notes: string;
}

export interface Noter extends Row {
  name: string;
  role: ContactRole | null;
}

export interface Prescriber extends Row {
  child_id: string;
  name: string;
  specialty: string;
  clinic: string;
  phone: string;
}

export interface Medicine extends Row {
  child_id: string;
  generic_name: string;
  brand_name: string;
  form: string;
  strength_text: string;
  prescriber_id: string | null;
  label_key: string | null;
  active: boolean;
  /** Where it is kept, how to give it: shown in the brief ("Blue box, kitchen shelf"). */
  notes: string;
}

export interface MedicineSchedule extends Row {
  medicine_id: string;
  times: string[]; // HH:MM
  /** null = every day; otherwise weekdays 0 (Sun) to 6 (Sat). */
  days: number[] | null;
  amount_text: string;
  with_food: boolean;
  starts_on: string | null;
  ends_on: string | null;
}

export interface Stock extends Row {
  medicine_id: string;
  units_left: number;
  units_per_dose: number;
  warn_at_days: number;
}

export const EVENT_KINDS = ['hard_moment', 'win', 'dose', 'sleep', 'food', 'school', 'health', 'note'] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type EventSource = 'tap' | 'help_now' | 'schedule' | 'show_mode' | 'check_in' | 'import';

export type DoseStatus = 'given' | 'late' | 'missed' | 'refused';

export interface DoseData {
  medicine_id: string;
  schedule_time: string | null;
  status: DoseStatus;
  amount_text: string;
}

export interface DayEvent extends Row {
  child_id: string;
  kind: EventKind;
  started_at: string;
  ended_at: string | null;
  size: number | null;
  place: string | null;
  data: Record<string, unknown>;
  note: string;
  noted_by: string | null;
  source: EventSource;
}

export interface EventTag extends Row {
  event_id: string;
  type: 'before' | 'helped';
  tag: string;
}

export const SITUATIONS = ['hard_moment', 'haircut', 'travel', 'sleep', 'food', 'other'] as const;
export type Situation = (typeof SITUATIONS)[number];

export interface PlaybookItem extends Row {
  child_id: string;
  situation: Situation;
  text: string;
  guide_slug: string | null;
  sort: number;
  helped_count: number;
}

export interface ShareRecord extends Row {
  child_id: string;
  what: 'brief' | 'visit_report' | 'passport' | 'backup';
  how: 'show' | 'pdf' | 'print' | 'file';
  to_text: string;
  language: Lang;
  at: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

/** Tables in backup order. */
export const TABLES = [
  'child',
  'profile_section',
  'contact',
  'noter',
  'prescriber',
  'medicine',
  'medicine_schedule',
  'stock',
  'event',
  'event_tag',
  'playbook_item',
  'share_record',
  'settings',
] as const;
export type TableName = (typeof TABLES)[number];
