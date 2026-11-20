import type { Table } from 'dexie';
import type { DaylineDB } from './db';
import { uuidv7 } from '../lib/id';
import { isoWithOffset, dayOf } from '../lib/time';
import type { DayEvent, EventTag, Row } from './types';

type Input<T extends Row> = Omit<T, keyof Row> & Partial<Pick<T, 'id'>>;

/** Repository over one table: soft delete, timestamps and UUIDv7 ids. */
export interface Repo<T extends Row> {
  all(includeDeleted?: boolean): Promise<T[]>;
  where(field: keyof T & string, value: unknown): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  add(input: Input<T>): Promise<T>;
  update(id: string, patch: Partial<Omit<T, keyof Row>>): Promise<void>;
  remove(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}

export function tableRepo<T extends Row>(table: Table<T, string>): Repo<T> {
  const live = (rows: T[]) => rows.filter((r) => !r.deleted_at);
  return {
    async all(includeDeleted = false) {
      const rows = await table.toArray();
      return includeDeleted ? rows : live(rows);
    },
    async where(field, value) {
      return live(await table.where(field).equals(value as string).toArray());
    },
    async get(id) {
      const row = await table.get(id);
      return row && !row.deleted_at ? row : undefined;
    },
    async add(input) {
      const now = isoWithOffset();
      const row = { ...input, id: input.id ?? uuidv7(), created_at: now, updated_at: now, deleted_at: null } as unknown as T;
      await table.put(row);
      return row;
    },
    async update(id, patch) {
      await table.update(id, { ...patch, updated_at: isoWithOffset() } as never);
    },
    async remove(id) {
      await table.update(id, { deleted_at: isoWithOffset(), updated_at: isoWithOffset() } as never);
    },
    async restore(id) {
      await table.update(id, { deleted_at: null, updated_at: isoWithOffset() } as never);
    },
  };
}

export interface EventRepo extends Repo<DayEvent> {
  forDay(childId: string, day: string): Promise<DayEvent[]>;
  between(childId: string, fromDay: string, toDay: string): Promise<DayEvent[]>;
  addWithTags(input: Input<DayEvent>, tags: { type: EventTag['type']; tag: string }[]): Promise<DayEvent>;
  tags(eventIds: string[]): Promise<EventTag[]>;
}

export function eventRepo(db: DaylineDB): EventRepo {
  const base = tableRepo(db.event);
  const tagRepo = tableRepo(db.event_tag);
  const between = async (childId: string, fromDay: string, toDay: string) => {
    const rows = await db.event
      .where('[child_id+started_at]')
      .between([childId, fromDay], [childId, `${toDay}\uffff`], true, true)
      .toArray();
    return rows.filter((e) => !e.deleted_at).sort((a, b) => a.started_at.localeCompare(b.started_at));
  };
  return {
    ...base,
    between,
    forDay: async (childId, day) => (await between(childId, day, day)).filter((e) => dayOf(e.started_at) === day),
    async addWithTags(input, tags) {
      return db.transaction('rw', db.event, db.event_tag, async () => {
        const ev = await base.add(input);
        for (const t of tags) await tagRepo.add({ event_id: ev.id, type: t.type, tag: t.tag });
        return ev;
      });
    },
    async tags(eventIds) {
      if (!eventIds.length) return [];
      return (await db.event_tag.where('event_id').anyOf(eventIds).toArray()).filter((t) => !t.deleted_at);
    },
  };
}

export interface SettingsRepo {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
}

export function settingsRepo(db: DaylineDB): SettingsRepo {
  return {
    async get(key, fallback) {
      const row = await db.settings.get(key);
      return row === undefined ? fallback : (row.value as typeof fallback);
    },
    async set(key, value) {
      await db.settings.put({ key, value });
    },
  };
}

export function createRepos(db: DaylineDB) {
  return {
    children: tableRepo(db.child),
    profile: tableRepo(db.profile_section),
    contacts: tableRepo(db.contact),
    noters: tableRepo(db.noter),
    prescribers: tableRepo(db.prescriber),
    medicines: tableRepo(db.medicine),
    schedules: tableRepo(db.medicine_schedule),
    stock: tableRepo(db.stock),
    events: eventRepo(db),
    playbook: tableRepo(db.playbook_item),
    shares: tableRepo(db.share_record),
    visits: tableRepo(db.visit),
    changes: tableRepo(db.change),
    checkIns: tableRepo(db.check_in),
    feedback: tableRepo(db.insight_feedback),
    settings: settingsRepo(db),
  };
}

export type Repos = ReturnType<typeof createRepos>;
