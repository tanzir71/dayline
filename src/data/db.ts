import Dexie, { type Table } from 'dexie';
import { migrations } from './migrations';
import type {
  Child, Contact, DayEvent, EventTag, Medicine, MedicineSchedule, Noter, PlaybookItem, Prescriber,
  ProfileSection, Setting, ShareRecord, Stock, Visit, Change, CheckIn, InsightFeedback,
} from './types';

export class DaylineDB extends Dexie {
  child!: Table<Child, string>;
  profile_section!: Table<ProfileSection, string>;
  contact!: Table<Contact, string>;
  noter!: Table<Noter, string>;
  prescriber!: Table<Prescriber, string>;
  medicine!: Table<Medicine, string>;
  medicine_schedule!: Table<MedicineSchedule, string>;
  stock!: Table<Stock, string>;
  event!: Table<DayEvent, string>;
  event_tag!: Table<EventTag, string>;
  playbook_item!: Table<PlaybookItem, string>;
  share_record!: Table<ShareRecord, string>;
  visit!: Table<Visit, string>;
  change!: Table<Change, string>;
  check_in!: Table<CheckIn, string>;
  insight_feedback!: Table<InsightFeedback, string>;
  settings!: Table<Setting, string>;

  constructor(name = 'dayline') {
    super(name);
    for (const m of migrations) this.version(m.version).stores(m.stores);
  }
}

let instance: DaylineDB | null = null;

export function getDB(): DaylineDB {
  instance ??= new DaylineDB();
  return instance;
}

/** Ask the browser not to clear Dayline's storage under pressure. Data still lives only on this phone. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
