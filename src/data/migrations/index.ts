/**
 * Forward-only schema versions. Each version lists its Dexie stores and, when needed,
 * a pure upgrade for exported backups so an old backup imports into a newer app.
 */
export interface Migration {
  version: number;
  stores: Record<string, string | null>;
  /** Transform backup tables written by the previous version. */
  upgradeBackup?: (tables: Record<string, unknown[]>) => Record<string, unknown[]>;
}

export const migrations: Migration[] = [
  {
    version: 1,
    stores: {
      child: 'id, deleted_at',
      profile_section: 'id, child_id, [child_id+section]',
      contact: 'id, child_id',
      noter: 'id, name',
      prescriber: 'id, child_id',
      medicine: 'id, child_id',
      medicine_schedule: 'id, medicine_id',
      stock: 'id, medicine_id',
      event: 'id, child_id, [child_id+started_at], kind',
      event_tag: 'id, event_id',
      playbook_item: 'id, child_id, [child_id+situation]',
      share_record: 'id, child_id',
      settings: 'key',
    },
  },
];

export const SCHEMA_VERSION = migrations[migrations.length - 1]!.version;

/** Bring backup tables from `fromVersion` up to the current schema. */
export function upgradeBackupTables(tables: Record<string, unknown[]>, fromVersion: number): Record<string, unknown[]> {
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(`This backup is from a newer Dayline (version ${fromVersion}). Update the app, then import again.`);
  }
  return migrations
    .filter((m) => m.version > fromVersion)
    .reduce((t, m) => (m.upgradeBackup ? m.upgradeBackup(t) : t), tables);
}
