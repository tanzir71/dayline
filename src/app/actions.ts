import type { AppCtx } from './context';
import type { DayEvent, DoseStatus, EventTag, Medicine } from '../data/types';
import { isoWithOffset } from '../lib/time';
import { doseStatusAt } from '../domain/schedule';
import { fmt } from '../i18n';
import { isNative } from '../native/is-native';

/** Record a dose; given doses count down the refill stock. Returns an undo. */
export async function markDose(
  ctx: Pick<AppCtx, 'repos' | 'child' | 'me'>,
  medicine: Medicine,
  scheduleTime: string | null,
  opts: { status?: DoseStatus; at?: string; amountText?: string; notedBy?: string | null; source?: DayEvent['source']; note?: string } = {},
): Promise<{ event: DayEvent; undo: () => Promise<void> }> {
  const at = opts.at ?? isoWithOffset();
  const status = opts.status ?? doseStatusAt(scheduleTime, at);
  const event = await ctx.repos.events.add({
    child_id: ctx.child!.id,
    kind: 'dose',
    started_at: at,
    ended_at: null,
    size: null,
    place: null,
    data: { medicine_id: medicine.id, schedule_time: scheduleTime, status, amount_text: opts.amountText ?? '' },
    note: opts.note ?? '',
    noted_by: opts.notedBy ?? (ctx.me || null),
    source: opts.source ?? 'tap',
  });
  const counts = status === 'given' || status === 'late';
  const stock = counts ? (await ctx.repos.stock.where('medicine_id', medicine.id))[0] : undefined;
  if (stock) await ctx.repos.stock.update(stock.id, { units_left: Math.max(0, stock.units_left - (stock.units_per_dose || 1)) });
  return {
    event,
    undo: async () => {
      await ctx.repos.events.remove(event.id);
      if (stock) await ctx.repos.stock.update(stock.id, { units_left: stock.units_left });
    },
  };
}

/** Save a moment with its just-before and what-helped tags. Returns an undo. */
export async function saveMoment(
  ctx: Pick<AppCtx, 'repos' | 'child'>,
  input: Omit<DayEvent, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'child_id'>,
  tags: { type: EventTag['type']; tag: string }[],
): Promise<() => Promise<void>> {
  const ev = await ctx.repos.events.addWithTags({ ...input, child_id: ctx.child!.id }, tags);
  return async () => ctx.repos.events.remove(ev.id);
}

/** Remember a "noted by" name. */
export async function rememberNoter(ctx: Pick<AppCtx, 'repos'>, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const all = await ctx.repos.noters.all();
  if (!all.some((n) => n.name.toLowerCase() === clean.toLowerCase())) await ctx.repos.noters.add({ name: clean, role: null });
  await ctx.repos.settings.set('lastNoter', clean);
}

/** Download or share a file made on this phone. */
export async function deliverFile(file: File, opts: { share?: boolean; title?: string } = {}): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (import.meta.env.PUBLIC_NATIVE === '1' && isNative()) {
    const { shareFiles } = await import('../native/bridge');
    return shareFiles([file], opts.title);
  }
  if (opts.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: opts.title ?? file.name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

export function fileSafeName(name: string): string {
  return name.normalize('NFC').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-') || 'child';
}

export function t1(template: string, vars: Record<string, string | number>, lang: AppCtx['lang']): string {
  return fmt(template, vars, lang);
}
