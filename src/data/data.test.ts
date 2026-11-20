import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { DaylineDB } from './db';
import { createRepos } from './repos';
import { exportBackup, importBackup, parseBackup, tableToCsv } from './backup';
import { migrations, SCHEMA_VERSION, upgradeBackupTables } from './migrations';
import Dexie from 'dexie';

let db: DaylineDB;
let n = 0;

beforeEach(async () => {
  db = new DaylineDB(`test-${n++}`);
  await db.open();
});

describe('repositories', () => {
  it('adds a child with timestamps and a UUIDv7 id', async () => {
    const r = createRepos(db);
    const c = await r.children.add({ name: 'Rafi', birth_month: '2019-04', language: 'bn', photo: null, hard_moment_word: null });
    expect(c.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(c.created_at).toMatch(/[+-]\d\d:\d\d$/);
    expect((await r.children.all()).map((x) => x.name)).toEqual(['Rafi']);
  });

  it('soft-deletes and restores', async () => {
    const r = createRepos(db);
    const c = await r.children.add({ name: 'Rafi', birth_month: null, language: 'en', photo: null, hard_moment_word: null });
    await r.children.remove(c.id);
    expect(await r.children.all()).toHaveLength(0);
    expect(await r.children.all(true)).toHaveLength(1);
    await r.children.restore(c.id);
    expect(await r.children.get(c.id)).toBeTruthy();
  });

  it('finds the events of a day, in time order, with tags', async () => {
    const r = createRepos(db);
    const base = { child_id: 'c1', ended_at: null, size: null, place: null, data: {}, note: '', noted_by: 'Amma', source: 'tap' as const };
    await r.events.add({ ...base, kind: 'win', started_at: '2026-11-20T14:15:00+06:00' });
    const hm = await r.events.addWithTags({ ...base, kind: 'hard_moment', started_at: '2026-11-20T12:40:00+06:00' }, [
      { type: 'before', tag: 'Transition' },
      { type: 'helped', tag: 'Break card' },
    ]);
    await r.events.add({ ...base, kind: 'sleep', started_at: '2026-11-19T21:00:00+06:00' });
    const day = await r.events.forDay('c1', '2026-11-20');
    expect(day.map((e) => e.kind)).toEqual(['hard_moment', 'win']);
    expect((await r.events.tags([hm.id])).map((t) => t.tag).sort()).toEqual(['Break card', 'Transition']);
  });

  it('keeps settings', async () => {
    const r = createRepos(db);
    expect(await r.settings.get('emergencyNumber', '999')).toBe('999');
    await r.settings.set('emergencyNumber', '112');
    expect(await r.settings.get('emergencyNumber', '999')).toBe('112');
  });
});

describe('migrations', () => {
  it('versions are strictly increasing, forward only', () => {
    const v = migrations.map((m) => m.version);
    expect(v).toEqual([...v].sort((a, b) => a - b));
    expect(new Set(v).size).toBe(v.length);
    expect(SCHEMA_VERSION).toBe(v[v.length - 1]);
  });

  it('opens an existing database created at version 1 without losing rows', async () => {
    const name = `upgrade-${n++}`;
    const v1 = new Dexie(name);
    v1.version(1).stores(migrations[0]!.stores);
    await v1.open();
    await v1.table('child').put({ id: 'c1', name: 'Rafi', deleted_at: null });
    v1.close();
    const current = new DaylineDB(name);
    await current.open();
    expect((await current.child.get('c1'))?.name).toBe('Rafi');
    expect(current.verno).toBe(SCHEMA_VERSION);
  });

  it('upgrades a version 1 backup: the M2 tables start empty', () => {
    const t = upgradeBackupTables({ child: [{ id: 'c1' }] }, 1);
    expect(t.child).toHaveLength(1);
    expect(t.visit).toEqual([]);
    expect(t.change).toEqual([]);
  });

  it('refuses a backup from a newer app', () => {
    expect(() => upgradeBackupTables({}, SCHEMA_VERSION + 1)).toThrow(/newer Dayline/);
  });
});

describe('backup', () => {
  it('round-trips: export, clear, import restores everything', async () => {
    const r = createRepos(db);
    const c = await r.children.add({ name: 'রাফি', birth_month: null, language: 'bn', photo: new Blob(['x'], { type: 'image/png' }), hard_moment_word: null });
    await r.contacts.add({ child_id: c.id, name: 'Amma', role: 'parent', phone: '01700000000', notes: '' });
    await r.settings.set('emergencyNumber', '999');
    const json = JSON.stringify(await exportBackup(db));

    await db.delete();
    db = new DaylineDB(`restored-${n++}`);
    await db.open();
    await importBackup(db, parseBackup(json));
    const r2 = createRepos(db);
    const kids = await r2.children.all();
    expect(kids[0]?.name).toBe('রাফি');
    expect(kids[0]?.photo).toBeInstanceOf(Blob);
    expect((await r2.contacts.all())[0]?.name).toBe('Amma');
    expect(await r2.settings.get('emergencyNumber', '')).toBe('999');
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Dayline backup/);
    expect(() => parseBackup('not json')).toThrow(/not a Dayline backup/);
  });

  it('writes CSV with quoting and a BOM', () => {
    const csv = tableToCsv([{ id: 'a', note: 'said "hi", then left' }]);
    expect(csv.startsWith('\uFEFFid,note')).toBe(true);
    expect(csv).toContain('"said ""hi"", then left"');
  });
});
