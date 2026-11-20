import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { useLive } from '../live';
import { Field, ScreenHeader, TextInput } from '../ui';
import { Icon } from '../../components/Icon';
import { fmt } from '../../i18n';
import { exportBackup, importBackup, parseBackup, tableToCsv } from '../../data/backup';
import { TABLES } from '../../data/types';
import { isoWithOffset, localDay } from '../../lib/time';
import { deliverFile, rememberNoter } from '../actions';
import { shortDate } from '../format';
import { Chip } from '../../components/Chip';
import { DEFAULT_CHECK_IN, type CheckInSettings } from './CheckIn';

/** Settings: language, emergency number, names, and backup (export, CSV, restore, delete). */
export function Settings() {
  const ctx = useApp();
  const { t, lang, repos, db, base } = ctx;
  const S = t.settings;
  const lastBackup = useLive(() => repos.settings.get<string | null>('lastBackup', null), [], null);
  const persisted = useLive(async () => (await navigator.storage?.persisted?.()) ?? false, [], false);
  const noters = useLive(() => repos.noters.all(), [], []);
  const checkIn = useLive(() => repos.settings.get<CheckInSettings>('checkIn', DEFAULT_CHECK_IN), [], DEFAULT_CHECK_IN);
  const setCheckIn = (v: Partial<CheckInSettings>) => void repos.settings.set('checkIn', { ...checkIn, ...v });
  const [emergency, setEmergency] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [newNoter, setNewNoter] = useState('');

  async function backupJson() {
    const b = await exportBackup(db);
    const file = new File([JSON.stringify(b, null, 1)], `dayline-backup-v${b.version}-${localDay()}.json`, { type: 'application/json' });
    const how = await deliverFile(file, { share: true });
    if (how !== 'cancelled') {
      await repos.settings.set('lastBackup', isoWithOffset());
      await repos.shares.add({ child_id: ctx.child?.id ?? '', what: 'backup', how: 'file', to_text: '', language: lang, at: isoWithOffset() });
    }
  }

  async function backupCsv() {
    const files: File[] = [];
    for (const name of TABLES) {
      const rows = (await db.table(name).toArray()) as Record<string, unknown>[];
      const clean = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([, v]) => !(v instanceof Blob))));
      if (clean.length) files.push(new File([tableToCsv(clean)], `dayline-${name}-${localDay()}.csv`, { type: 'text/csv' }));
    }
    if (files.length && navigator.canShare?.({ files })) {
      try {
        await navigator.share({ files });
        return;
      } catch {
        /* fall back to downloads */
      }
    }
    for (const f of files) await deliverFile(f);
  }

  async function restore(file: File) {
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(fmt(S.importConfirm, { date: backup.exported_at ? shortDate(backup.exported_at, lang) : '?' }))) return;
      await importBackup(db, backup);
      setMessage(S.imported);
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      setMessage(fmt(S.importFailed, { reason: (e as Error).message }));
    }
  }

  async function deleteAll() {
    if (!confirm(S.deleteConfirm)) return;
    db.close();
    await db.delete();
    location.hash = '#/onboarding';
    location.reload();
  }

  const otherHref = `${base}${lang === 'en' ? 'bn/' : ''}app/#/settings`;

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 18px">
        <ScreenHeader title={S.title} backTo={ctx.child ? '/child' : '/today'} />

        <section class="card stack" style="--stack-gap: 12px">
          <h2 class="t-heading-17">{S.language}</h2>
          <a class="btn btn--secondary" href={otherHref} data-lang-switch={lang === 'en' ? 'bn' : 'en'}>
            <span lang={lang === 'en' ? 'bn' : 'en'}>{lang === 'en' ? 'বাংলা' : 'English'}</span>
          </a>
        </section>

        <form
          class="card stack"
          style="--stack-gap: 12px"
          onSubmit={async (e) => {
            e.preventDefault();
            if (emergency !== null && emergency.trim()) await repos.settings.set('emergencyNumber', emergency.trim());
            if (me !== null) {
              await repos.settings.set('me', me.trim());
              if (me.trim()) await rememberNoter(ctx, me);
            }
            ctx.toast(t.common.saved);
          }}
        >
          <Field id="st-emergency" label={S.emergency} hint={S.emergencyHint}>
            <TextInput id="st-emergency" type="tel" inputMode="tel" value={emergency ?? ctx.emergency} onValue={setEmergency} maxLength={20} />
          </Field>
          <Field id="st-me" label={S.me} optional>
            <TextInput id="st-me" value={me ?? ctx.me} onValue={setMe} maxLength={30} />
          </Field>
          <button type="submit" class="btn btn--primary">
            {t.common.save}
          </button>
        </form>

        <section class="card stack" style="--stack-gap: 10px">
          <h2 class="t-heading-17">{S.noters}</h2>
          <ul class="list-plain playbook-list" role="list">
            {noters.map((n) => (
              <li key={n.id}>
                <span>{n.name}</span>
                <button type="button" class="icon-btn" aria-label={`${t.common.delete}: ${n.name}`} onClick={() => void repos.noters.remove(n.id)}>
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
          <form
            class="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newNoter.trim()) return;
              await rememberNoter(ctx, newNoter);
              setNewNoter('');
            }}
          >
            <TextInput aria-label={S.noterAdd} placeholder={S.noterAdd} value={newNoter} onValue={setNewNoter} maxLength={30} />
            <button type="submit" class="btn btn--secondary btn--sm">
              {t.common.add}
            </button>
          </form>
        </section>

        {ctx.flags.insights && (
          <section class="card stack" style="--stack-gap: 10px">
            <h2 class="t-heading-17">{t.checkIn.settings}</h2>
            <p class="t-caption-13 muted">{t.checkIn.settingsHint}</p>
            <div class="chip-group" role="radiogroup" aria-label={t.checkIn.day}>
              <Chip mode="single" on={!checkIn.on} onClick={() => setCheckIn({ on: false })}>
                {t.checkIn.off}
              </Chip>
              {t.medicines.weekdays.map((wd, i) => (
                <Chip key={wd} mode="single" on={checkIn.on && checkIn.day === i} onClick={() => setCheckIn({ on: true, day: i })}>
                  {wd}
                </Chip>
              ))}
            </div>
            {checkIn.on && (
              <label class="check">
                {t.checkIn.time}
                <input type="time" class="input input--time" value={checkIn.time} onInput={(e) => setCheckIn({ time: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            )}
          </section>
        )}

        <section class="card stack" style="--stack-gap: 12px" id="backup">
          <h2 class="t-heading-17">{S.backup}</h2>
          <p class="t-body-14 muted">{S.backupBody}</p>
          <p class="t-body-strong-14">{lastBackup ? fmt(S.lastBackup, { date: shortDate(lastBackup, lang) }) : S.never}</p>
          <button type="button" class="btn btn--primary" onClick={() => void backupJson()}>
            <Icon name="download" size={20} />
            {S.exportJson}
          </button>
          <button type="button" class="btn btn--secondary" onClick={() => void backupCsv()}>
            {S.exportCsv}
          </button>
          <label class="btn btn--secondary file-btn">
            {S.import}
            <input
              type="file"
              accept="application/json,.json"
              class="sr-only"
              onChange={(e) => {
                const f = (e.currentTarget as HTMLInputElement).files?.[0];
                if (f) void restore(f);
                (e.currentTarget as HTMLInputElement).value = '';
              }}
            />
          </label>
          <p class="t-caption-13 muted">{persisted ? S.storage : S.storageNot}</p>
          {message && (
            <p class="t-body-14" role="status">
              {message}
            </p>
          )}
        </section>

        <section class="card stack" style="--stack-gap: 10px">
          <a class="btn btn--ghost" href={ctx.site('privacy/')}>
            {S.privacy}
          </a>
          <button type="button" class="btn btn--ghost btn--danger" onClick={() => void deleteAll()}>
            {S.deleteAll}
          </button>
        </section>
      </main>
    </div>
  );
}
