import { App } from '@capacitor/app';
import { useEffect, useState } from 'preact/hooks';
import { rememberNoter } from '../app/actions';
import { useApp } from '../app/context';
import { shortDate } from '../app/format';
import { useLive } from '../app/live';
import { Sheet } from '../app/ui';
import { Chip } from '../components/Chip';
import { Icon } from '../components/Icon';
import { fmt } from '../i18n';
import { voiceStatus, type VoiceStatus } from './bridge';
import { enableReminders, REMINDERS_ON } from './reminders';

const SITE = 'https://tanzir71.github.io/dayline/';

/** Settings · This app (06): voice, who is speaking, reminders, backup, version. */
export function ThisApp() {
  const ctx = useApp();
  const { t, lang, repos, me } = ctx;
  const V = t.voice;
  const S = t.settings;
  const noters = useLive(() => repos.noters.all(), [], []);
  const lastNoter = useLive(() => repos.settings.get<string>('lastNoter', ''), [], '');
  const lastBackup = useLive(() => repos.settings.get<string | null>('lastBackup', null), [], null);
  const remindersOn = useLive(() => repos.settings.get<boolean>(REMINDERS_ON, false), [], false);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [version, setVersion] = useState('');
  const [picking, setPicking] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    void voiceStatus().then(setStatus);
    void App.getInfo().then((i) => setVersion(i.version));
  }, []);

  const installed = status?.installed ?? [];
  const langs = [installed.includes('bn-BD') ? 'বাংলা' : '', installed.includes('en-US') ? 'English' : ''].filter(Boolean).join(' + ');
  const names = [...new Set([me, ...noters.map((n) => n.name)].filter(Boolean))];
  const speaker = lastNoter || me;
  const updateUrl = `${SITE}${lang === 'bn' ? 'bn/' : ''}android/?have=${encodeURIComponent(version)}`;

  async function toggleReminders() {
    setBlocked(false);
    if (remindersOn) await repos.settings.set(REMINDERS_ON, false);
    else if (!(await enableReminders(ctx))) setBlocked(true);
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 12px">
        <header class="screen-head">
          <a class="back-link" href="#/settings">
            <Icon name="chevron-left" size={18} />
            {S.title}
          </a>
          <h1 class="screen-title">{V.thisApp}</h1>
        </header>

        <div class="voice-list">
          <a class="voice-row voice-row--link" href="#/settings/app?sheet=speak&setup=1">
            <span class="voice-row__text">
              <span class="t-body-strong-15">{V.voiceRow}</span>
              <span class="t-caption-13 muted">{langs ? fmt(V.voiceOffline, { langs }) : V.typingOnly}</span>
            </span>
            <Icon name="chevron-right" size={20} />
          </a>
          <button type="button" class="voice-row voice-row--link" onClick={() => setPicking(true)}>
            <span class="voice-row__text">
              <span class="t-body-strong-15">{V.whoSpeaking}</span>
              <span class="t-caption-13 muted">{speaker || t.log.addName}</span>
            </span>
            <Icon name="chevron-right" size={20} />
          </button>
          <button type="button" class="voice-row voice-row--link" role="switch" aria-checked={remindersOn} onClick={() => void toggleReminders()}>
            <span class="voice-row__text">
              <span class="t-body-strong-15">{V.reminders}</span>
              <span class={`t-caption-13 ${blocked ? 'voice-caution' : 'muted'}`}>{blocked ? V.remindersBlocked : remindersOn ? V.remindersOn : V.remindersOff}</span>
            </span>
            <Icon name="chevron-right" size={20} />
          </button>
          <a class="voice-row voice-row--link" href="#/settings">
            <span class="voice-row__text">
              <span class="t-body-strong-15">{S.backup}</span>
              <span class="t-caption-13 muted">{lastBackup ? fmt(S.lastBackup, { date: shortDate(lastBackup, lang) }) : S.never}</span>
            </span>
            <Icon name="chevron-right" size={20} />
          </a>
        </div>

        <section class="card stack" style="--stack-gap: 10px">
          <p class="t-body-strong-15">{fmt(V.version, { version })}</p>
          <p class="t-caption-13 muted">{V.checkUpdatesBody}</p>
          <a class="btn btn--secondary btn--sm" href={updateUrl}>
            {V.checkUpdates}
          </a>
        </section>

        <p class="voice-hint">
          <Icon name="mic" size={18} />
          <span class="t-caption-13 muted">{V.shortcutsHint}</span>
        </p>
      </main>

      {picking && (
        <Sheet title={V.whoSpeaking} onClose={() => setPicking(false)}>
          <div class="chip-group" role="radiogroup" aria-label={V.whoSpeaking}>
            {names.map((n) => (
              <Chip
                key={n}
                mode="single"
                on={speaker === n}
                onClick={() => {
                  void rememberNoter(ctx, n);
                  setPicking(false);
                }}
              >
                {n}
              </Chip>
            ))}
          </div>
          {!names.length && <p class="t-body-14 muted">{S.noters}</p>}
        </Sheet>
      )}
    </div>
  );
}
