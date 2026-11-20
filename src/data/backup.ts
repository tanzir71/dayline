import type { DaylineDB } from './db';
import { SCHEMA_VERSION, upgradeBackupTables } from './migrations';
import { TABLES, type TableName } from './types';
import { isoWithOffset } from '../lib/time';

export const BACKUP_FORMAT = 'dayline-backup';

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exported_at: string;
  tables: Record<TableName, unknown[]>;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const type = /data:([^;]+)/.exec(head ?? '')?.[1] ?? 'application/octet-stream';
  const bin = atob(b64 ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Everything in this phone's database, as one JSON document (dayline-backup-v1.json). */
export async function exportBackup(db: DaylineDB): Promise<Backup> {
  const tables = {} as Record<TableName, unknown[]>;
  for (const name of TABLES) {
    const rows = (await db.table(name).toArray()) as Record<string, unknown>[];
    tables[name] = await Promise.all(
      rows.map(async (r) => {
        const out: Record<string, unknown> = { ...r };
        for (const [k, v] of Object.entries(r)) if (v instanceof Blob) out[k] = await blobToDataUrl(v);
        return out;
      }),
    );
  }
  return { format: BACKUP_FORMAT, version: SCHEMA_VERSION, exported_at: isoWithOffset(), tables };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not a Dayline backup.');
  }
  const b = data as Partial<Backup>;
  if (b?.format !== BACKUP_FORMAT || typeof b.version !== 'number' || typeof b.tables !== 'object' || !b.tables) {
    throw new Error('This file is not a Dayline backup.');
  }
  const tables = upgradeBackupTables(b.tables as Record<string, unknown[]>, b.version) as Record<TableName, unknown[]>;
  return { format: BACKUP_FORMAT, version: SCHEMA_VERSION, exported_at: String(b.exported_at ?? ''), tables };
}

/** Replace everything on this device with the backup. There is no merge. */
export async function importBackup(db: DaylineDB, backup: Backup): Promise<void> {
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const name of TABLES) {
      const table = db.table(name);
      await table.clear();
      const rows = (backup.tables[name] ?? []).map((r) => {
        const row = { ...(r as Record<string, unknown>) };
        if (name === 'child' && typeof row.photo === 'string' && row.photo.startsWith('data:')) row.photo = dataUrlToBlob(row.photo);
        return row;
      });
      if (rows.length) await table.bulkPut(rows);
    }
  });
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV per table for spreadsheets (UTF-8 with BOM so Excel shows Bangla). */
export function tableToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '\uFEFF';
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return '\uFEFF' + [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n';
}
