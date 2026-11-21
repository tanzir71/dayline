import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../app/context';
import { useChildData, useEvents } from '../app/data';
import { useLive } from '../app/live';
import { markDose } from '../app/actions';
import { describeEvent, hardWord, hhmmLabel, KIND_TONE, wallTime } from '../app/format';
import { go } from '../app/router';
import { Icon } from '../components/Icon';
import type { DayEvent, DoseData, EventKind, Medicine } from '../data/types';
import { scheduleActiveOn } from '../domain/schedule';
import { parse, type Draft, type VoiceCtx } from '../domain/voice/parse';
import { fmt } from '../i18n';
import { localDay, minutesOf, minutesToHhmm } from '../lib/time';
import { cancelVoice, downloadVoice, onVoice, requestMic, startVoice, stopVoice, voiceStatus, type VoiceErrorCode, type VoiceLang, type VoiceStatus } from './bridge';

type Phase = 'checking' | 'setup' | 'listening' | 'typing' | 'result';
interface SavedItem {
  id: string;
  undo: () => Promise<void>;
}
interface Held {
  draft: Draft;
  note: SavedItem;
}

const AUTO_CLOSE_MS = 6000;
const ALIASES = 'voice.aliases';
const SETUP_SEEN = 'voice.setupSeen';
export const VOICE_USED = 'voice.usedAt';
const other = (l: VoiceLang): VoiceLang => (l === 'bn-BD' ? 'en-US' : 'bn-BD');

/** How much of the new partial text matches the last one: settled words are ink, the rest secondary. */
function settledLength(prev: string, next: string): number {
  const a = prev.split(' ');
  const b = next.split(' ');
  let i = 0;
  while (i < a.length - 1 && i < b.length && a[i] === b[i]) i++;
  return b.slice(0, i).join(' ').length;
}

function VoiceSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current)?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-sheet');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-sheet');
    };
  }, []);
  return (
    <>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet voice-sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref} tabIndex={-1}>
        <div class="sheet__grabber" aria-hidden="true" />
        {children}
      </div>
    </>
  );
}

/** Speak: listen on the phone, parse, save at once, then show what was saved (screens 02 to 05b). */
export function SpeakSheet({ onClose, medicineId, setup }: { onClose: () => void; medicineId: string | null; setup: boolean }) {
  const ctx = useApp();
  const { t, lang, child, repos } = ctx;
  const V = t.voice;
  const today = localDay();
  const data = useChildData();
  const { events } = useEvents(today, today);
  const aliases = useLive(() => repos.settings.get<Record<string, string>>(ALIASES, {}), [], {});
  const lastNoter = useLive(() => repos.settings.get<string>('lastNoter', ''), [], '');

  const [phase, setPhase] = useState<Phase>('checking');
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [requested, setRequested] = useState<VoiceLang[]>([]);
  const [transcript, setTranscript] = useState({ text: '', settled: 0 });
  const [level, setLevel] = useState(0);
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState('');
  const [typed, setTyped] = useState('');
  const [heard, setHeard] = useState('');
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [held, setHeld] = useState<Held[]>([]);
  const [picking, setPicking] = useState(false);
  const [touched, setTouched] = useState(false);

  const latest = useRef({ data, events, aliases, lastNoter });
  latest.current = { data, events, aliases, lastNoter };
  const listening = useRef(false);
  const busyRetried = useRef(false);
  const lastStart = useRef<VoiceLang | undefined>(undefined);
  const handled = useRef(false);

  const wantLang: VoiceLang = lang === 'bn' ? 'bn-BD' : 'en-US';

  function voiceCtx(): VoiceCtx {
    const { data: d, events: ev, aliases: al } = latest.current;
    return {
      now: new Date(),
      lang,
      child: { name: child!.name, hard_moment_word: child!.hard_moment_word },
      medicines: d.medicines
        .filter((m) => m.active)
        .map((m) => ({
          id: m.id,
          generic_name: m.generic_name,
          brand_name: m.brand_name,
          strength_text: m.strength_text,
          times: d.schedules.filter((s) => s.medicine_id === m.id && scheduleActiveOn(s, today)).flatMap((s) => s.times),
        })),
      aliases: al,
      playbookHelped: d.playbook.filter((p) => p.situation === 'hard_moment').map((p) => p.text),
      loggedToday: ev
        .filter((e) => e.kind === 'dose')
        .map((e) => {
          const dose = e.data as unknown as DoseData;
          return { medicine_id: dose.medicine_id, schedule_time: dose.schedule_time };
        }),
      labels: t.log,
    };
  }

  const noter = () => latest.current.lastNoter || ctx.me || null;

  async function saveAsNote(d: Draft): Promise<SavedItem> {
    const ev = await repos.events.addWithTags(
      { child_id: child!.id, kind: 'note', started_at: d.started_at, ended_at: null, size: null, place: null, data: {}, note: d.heard, noted_by: noter(), source: 'voice' },
      [],
    );
    return { id: ev.id, undo: () => repos.events.remove(ev.id) };
  }

  async function saveDose(d: Draft, m: Medicine): Promise<SavedItem> {
    const sched = latest.current.data.schedules.find((s) => s.medicine_id === m.id);
    const said = d.data.status;
    const r = await markDose(ctx, m, (d.data.schedule_time as string | null | undefined) ?? null, {
      status: said === 'missed' || said === 'refused' ? said : undefined,
      at: d.started_at,
      amountText: sched?.amount_text ?? '',
      notedBy: noter(),
      source: 'voice',
      note: d.heard,
    });
    return { id: r.event.id, undo: r.undo };
  }

  async function saveDraft(d: Draft): Promise<SavedItem> {
    if (d.kind === 'dose') {
      const m = latest.current.data.medicines.find((x) => x.id === d.medicine_id);
      return m ? saveDose(d, m) : saveAsNote(d);
    }
    if (d.kind === 'note') return saveAsNote(d);
    const ev = await repos.events.addWithTags(
      { child_id: child!.id, kind: d.kind, started_at: d.started_at, ended_at: d.ended_at, size: d.size, place: d.place, data: d.data, note: d.heard, noted_by: noter(), source: 'voice' },
      d.tags,
    );
    const bumped: { id: string; count: number }[] = [];
    for (const tag of d.tags.filter((x) => x.type === 'helped')) {
      const item = latest.current.data.playbook.find((p) => p.text === tag.tag);
      if (item) {
        bumped.push({ id: item.id, count: item.helped_count });
        await repos.playbook.update(item.id, { helped_count: item.helped_count + 1 });
      }
    }
    return {
      id: ev.id,
      undo: async () => {
        await repos.events.remove(ev.id);
        for (const b of bumped) await repos.playbook.update(b.id, { helped_count: b.count });
      },
    };
  }

  async function commit(text: string, drafts: Draft[]) {
    try {
      const items: SavedItem[] = [];
      const questions: Held[] = [];
      for (const raw of drafts) {
        const d: Draft = raw.question?.type === 'which_medicine' && medicineId ? { ...raw, medicine_id: medicineId, question: undefined } : raw;
        // A held question is already safe as a note, so its words survive even if the app is closed.
        if (d.question) questions.push({ draft: d, note: await saveAsNote(d) });
        else items.push(await saveDraft(d));
      }
      await repos.settings.set(VOICE_USED, new Date().toISOString());
      setHeard(text);
      setSaved(items);
      setHeld(questions);
      setPhase('result');
    } catch {
      setTyped(text);
      setNotice(t.dbError);
      setPhase('typing');
    }
  }

  function understand(texts: string[]) {
    const vctx = voiceCtx();
    for (const text of [...new Set(texts)]) {
      const drafts = parse(text, vctx);
      if (drafts.length) {
        void commit(text, drafts);
        return true;
      }
    }
    return false;
  }

  async function listen(forced?: VoiceLang) {
    const s = await voiceStatus();
    setStatus(s);
    if (s.micPermission !== 'granted') {
      setPhase('setup');
      return;
    }
    const want = forced ?? wantLang;
    const primary = s.installed.length && !s.installed.includes(want) ? other(want) : want;
    const also = s.installed.includes(other(primary)) ? [other(primary)] : [];
    lastStart.current = forced;
    handled.current = false;
    setTranscript({ text: '', settled: 0 });
    setNotice('');
    setStopping(false);
    setLevel(0);
    listening.current = true;
    setPhase('listening');
    await startVoice({ primary, also, maxMs: 30_000 });
  }

  function onError(code: VoiceErrorCode) {
    listening.current = false;
    if (code === 'busy' && !busyRetried.current) {
      busyRetried.current = true;
      setTimeout(() => void listen(lastStart.current), 300);
    } else if (code === 'language_unavailable') {
      setBlocked(true);
      setPhase('setup');
    } else if (code === 'permission') {
      setPhase('setup');
    } else {
      setStopping(false);
      setNotice(V.notCaught);
    }
  }

  useEffect(() => {
    const subs = [
      onVoice('partial', ({ text }) => setTranscript((p) => ({ text, settled: settledLength(p.text, text) }))),
      onVoice('level', ({ rms }) => setLevel(Math.min(1, Math.max(0, (rms + 2) / 12)))),
      onVoice('final', ({ text, alternatives }) => {
        listening.current = false;
        if (handled.current) return;
        handled.current = true;
        setTranscript({ text, settled: text.length });
        if (!understand([text, ...alternatives])) {
          setStopping(false);
          setNotice(V.notCaught);
        }
      }),
      onVoice('error', ({ code }) => onError(code)),
    ];
    return () => {
      subs.forEach((s) => void s.then((off) => off()));
      if (listening.current) void cancelVoice();
    };
  }, []);

  useEffect(() => {
    if (!data.ready || phase !== 'checking') return;
    void (async () => {
      const s = await voiceStatus();
      setStatus(s);
      const seen = await repos.settings.get(SETUP_SEEN, false);
      const mustDownload = !s.installed.length && (s.downloadable.length > 0 || s.pending.length > 0);
      if (setup || (s.supported && (!seen || s.micPermission !== 'granted' || mustDownload))) setPhase('setup');
      else if (!s.supported) setPhase('typing');
      else await listen();
    })();
  }, [data.ready]);

  // While a language pack downloads, keep its row current.
  useEffect(() => {
    if (phase !== 'setup' || !(status?.pending.length || requested.length)) return;
    const timer = setInterval(() => void voiceStatus().then(setStatus), 3000);
    return () => clearInterval(timer);
  }, [phase, status?.pending.length, requested.length]);

  // Saved closes by itself if nobody touches it and nothing is waiting for an answer.
  useEffect(() => {
    if (phase !== 'result' || touched || held.length) return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [phase, touched, held.length]);

  async function leaveSetup(next: () => void | Promise<void>) {
    await repos.settings.set(SETUP_SEEN, true);
    await next();
  }

  function cancelListening() {
    listening.current = false;
    void cancelVoice();
    onClose();
  }

  async function undoAll() {
    for (const item of [...saved, ...held.map((h) => h.note)].reverse()) await item.undo();
    ctx.toast(t.common.deleted);
    onClose();
  }

  async function answer(m: Medicine, remember: boolean) {
    const [h, ...rest] = held;
    if (!h) return;
    await h.note.undo();
    const item = await saveDose({ ...h.draft, medicine_id: m.id, question: undefined }, m);
    const name = h.draft.question?.heard_name?.trim().toLowerCase();
    if (remember && name) await repos.settings.set(ALIASES, { ...latest.current.aliases, [name]: m.id });
    setSaved((s) => [...s, item]);
    setHeld(rest);
    setPicking(false);
  }

  async function addMedicine(name: string) {
    const m = await repos.medicines.add({ child_id: child!.id, generic_name: name, brand_name: '', form: '', strength_text: '', prescriber_id: null, label_key: null, active: true, notes: '' });
    await answer(m, false);
  }

  function keepNote() {
    const [h, ...rest] = held;
    if (!h) return;
    setSaved((s) => [...s, h.note]);
    setHeld(rest);
    setPicking(false);
  }

  if (phase === 'checking') return null;

  if (phase === 'setup') {
    return (
      <VoiceSetup
        status={status}
        blocked={blocked}
        requested={requested}
        onClose={onClose}
        onAllow={async () => {
          await requestMic();
          setStatus(await voiceStatus());
        }}
        onDownload={async (l) => {
          const { started } = await downloadVoice(l);
          if (started) setRequested((r) => [...new Set([...r, l])]);
          else setBlocked(true);
          setStatus(await voiceStatus());
        }}
        onTry={(l) => void leaveSetup(() => listen(l))}
        onType={() => void leaveSetup(() => setPhase('typing'))}
      />
    );
  }

  if (phase === 'typing') {
    return (
      <VoiceSheet label={V.typeInstead} onClose={onClose}>
        <form
          class="voice-stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (!typed.trim()) return;
            if (!understand([typed.trim()])) setNotice(V.notCaught);
          }}
        >
          <label class="field__label" for="voice-typed">
            {V.typeInstead}
          </label>
          <textarea id="voice-typed" data-autofocus class="input voice-typed" rows={3} maxLength={1000} placeholder={V.typePlaceholder} value={typed} onInput={(e) => setTyped((e.currentTarget as HTMLTextAreaElement).value)} />
          {notice && (
            <p class="t-body-14 voice-notice" role="status">
              {notice}
            </p>
          )}
          <p class="voice-privacy">
            <Icon name="shield" size={16} />
            {V.offline}
          </p>
          <div class="voice-buttons">
            <button type="button" class="btn btn--secondary" onClick={onClose}>
              {t.common.cancel}
            </button>
            <button type="submit" class="btn btn--primary" disabled={!typed.trim()}>
              {t.common.done}
            </button>
          </div>
        </form>
      </VoiceSheet>
    );
  }

  if (phase === 'listening') {
    const langs = status?.installed.length === 2 ? 'বাংলা + English' : status?.installed.includes('bn-BD') ? 'বাংলা' : 'English';
    return (
      <VoiceSheet label={V.listening} onClose={cancelListening}>
        <div class="voice-stack">
          <div class="voice-status">
            <p class="overline tone-monsoon">
              <span class="overline__dot" aria-hidden="true" />
              <span class="t-overline-12">{V.listening}</span>
            </p>
            <span class="voice-status__end">
              <span class="t-caption-13 muted">{langs}</span>
              <button type="button" class="icon-btn" aria-label={V.typeInstead} onClick={() => {
                listening.current = false;
                void cancelVoice();
                setTyped(transcript.text);
                setPhase('typing');
              }}>
                <Icon name="keyboard" size={20} />
              </button>
            </span>
          </div>
          <p class="voice-transcript" aria-live="polite">
            {transcript.text.slice(0, transcript.settled)}
            <span class="muted">{transcript.text.slice(transcript.settled)}</span>
          </p>
          {notice ? (
            <div class="voice-stack voice-retry">
              <p class="t-body-14 voice-notice" role="status">
                {notice}
              </p>
              <div class="voice-buttons">
                <button type="button" class="btn btn--secondary" onClick={() => setPhase('typing')}>
                  {V.typeInstead}
                </button>
                <button type="button" class="btn btn--primary" onClick={() => void listen(lastStart.current)}>
                  {V.speak}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div class="voice-orb" style={{ '--level': level }} aria-hidden="true">
                <span class="voice-orb__core">
                  <Icon name="mic" size={32} />
                </span>
              </div>
              <p class="t-caption-13 muted voice-center">{V.listenHint}</p>
              <p class="voice-privacy">
                <Icon name="shield" size={16} />
                {V.offline}
              </p>
              <div class="voice-buttons">
                <button type="button" class="btn btn--secondary" onClick={cancelListening}>
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  class="btn btn--primary"
                  disabled={stopping}
                  onClick={() => {
                    setStopping(true);
                    void stopVoice();
                  }}
                >
                  {t.common.done}
                </button>
              </div>
            </>
          )}
        </div>
      </VoiceSheet>
    );
  }

  const q = held[0];
  const time = q ? hhmmLabel(minutesToHhmm(minutesOf(q.draft.started_at)), lang) : '';
  const heardName = q?.draft.question?.heard_name ?? '';
  const displayName = heardName ? heardName.charAt(0).toUpperCase() + heardName.slice(1) : '';
  const active = data.medicines.filter((m) => m.active);
  const options = q?.draft.question?.options?.length ? active.filter((m) => q.draft.question!.options!.includes(m.generic_name)) : active;

  return (
    <VoiceSheet label={fmt(V.saved, { n: saved.length }, lang)} onClose={onClose}>
      <div class="voice-stack" onPointerDown={() => setTouched(true)}>
        <p class="voice-saved">
          <Icon name="check" size={16} />
          <span class="t-overline-12">{fmt(V.saved, { n: saved.length }, lang)}</span>
        </p>
        <p class="voice-quote">“{heard}”</p>
        {saved.length > 0 && (
          <ul class="list-plain voice-cards" role="list">
            {saved.map((s) => (
              <li key={s.id}>
                <HeardCard id={s.id} medicines={data.medicines} />
              </li>
            ))}
          </ul>
        )}
        {q && (
          <section class="voice-question">
            <p class="overline voice-question__label">
              <span class="overline__dot" aria-hidden="true" />
              <span class="t-overline-12">{V.question}</span>
            </p>
            {q.draft.question!.type === 'new_medicine' && !picking ? (
              <>
                <p class="t-body-strong-15">{fmt(V.newMedicine, { name: displayName, child: child!.name })}</p>
                <p class="t-caption-13 muted">{fmt(V.newMedicineBody, { time })}</p>
                <div class="chip-group voice-answers">
                  <button type="button" class="chip chip--selected" onClick={() => void addMedicine(displayName)}>
                    {fmt(V.addIt, { name: displayName })}
                  </button>
                  {active.length > 0 && (
                    <button type="button" class="chip chip--default" onClick={() => setPicking(true)}>
                      {V.another}
                    </button>
                  )}
                  <button type="button" class="chip chip--default" onClick={keepNote}>
                    {V.keepNote}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p class="t-body-strong-15">{V.whichMedicine}</p>
                <div class="chip-group voice-answers">
                  {options.map((m) => (
                    <button key={m.id} type="button" class="chip chip--default" onClick={() => void answer(m, q.draft.question!.type === 'new_medicine')}>
                      {m.generic_name}
                    </button>
                  ))}
                  <button type="button" class="chip chip--default" onClick={keepNote}>
                    {V.keepNote}
                  </button>
                </div>
              </>
            )}
          </section>
        )}
        <p class="t-caption-13 muted voice-center">{q ? V.closeKeeps : V.tapToFix}</p>
        {q ? (
          <button type="button" class="btn btn--primary btn--block" onClick={onClose}>
            {t.common.done}
          </button>
        ) : (
          <div class="voice-buttons">
            <button type="button" class="btn btn--secondary" onClick={() => void undoAll()}>
              {V.undo}
            </button>
            <button type="button" class="btn btn--primary" onClick={onClose}>
              {t.common.done}
            </button>
          </div>
        )}
      </div>
    </VoiceSheet>
  );
}

function HeardCard({ id, medicines }: { id: string; medicines: Medicine[] }) {
  const ctx = useApp();
  const { t, lang, repos, child } = ctx;
  const row = useLive(
    async () => {
      const event = await repos.events.get(id);
      return event ? { event, tags: await repos.events.tags([id]) } : null;
    },
    [id],
    null,
  );
  if (!row) return null;
  const e: DayEvent = row.event;
  const d = describeEvent(e, row.tags, medicines, ctx);
  const tone = KIND_TONE[e.kind] ?? 'neutral';
  const kindLabel = e.kind === 'hard_moment' ? hardWord(child, ctx) : t.kinds[e.kind as EventKind];
  const detail = [wallTime(e.started_at, lang), d.detail.split(' · ').filter((x) => x !== t.voice.byVoice).join(' · ')].filter(Boolean).join(' · ');
  return (
    <button type="button" class={`heard-card heard-card--${tone}`} onClick={() => go(`/today?sheet=log&event=${id}`, true)}>
      <span class="heard-card__bar" aria-hidden="true" />
      <span class="heard-card__text">
        <span class="heard-card__kind t-overline-12">{kindLabel}</span>
        <span class="t-body-strong-15">{d.title}</span>
        <span class="t-caption-13 muted">{detail}</span>
      </span>
      <Icon name="chevron-right" size={22} />
    </button>
  );
}

function VoiceSetup({
  status,
  blocked,
  requested,
  onClose,
  onAllow,
  onDownload,
  onTry,
  onType,
}: {
  status: VoiceStatus | null;
  blocked: boolean;
  requested: VoiceLang[];
  onClose: () => void;
  onAllow: () => Promise<void>;
  onDownload: (l: VoiceLang) => Promise<void>;
  onTry: (l?: VoiceLang) => void;
  onType: () => void;
}) {
  const { t, child, lang } = useApp();
  const V = t.voice;
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-sheet');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-sheet');
    };
  }, []);

  const micOk = status?.micPermission === 'granted';
  const state = (l: VoiceLang): 'ready' | 'download' | 'pending' | 'none' | 'unknown' => {
    if (status?.installed.includes(l)) return 'ready';
    if (status?.pending.includes(l) || requested.includes(l)) return 'pending';
    if (status?.downloadable.includes(l)) return 'download';
    // Android 12 can't report languages, so we only know after trying.
    if (status?.supported && !status.installed.length && !status.downloadable.length && !status.pending.length && !blocked) return 'unknown';
    return 'none';
  };
  const bn = state('bn-BD');
  const en = state('en-US');
  const banglaOut = bn === 'none';
  const canSpeak = micOk && (bn === 'ready' || en === 'ready' || bn === 'unknown');

  const row = (l: VoiceLang, title: string, sub: string) => {
    const s = l === 'bn-BD' ? bn : en;
    return (
      <div class="voice-row">
        <span class="voice-row__text">
          <span class="t-body-strong-15">{title}</span>
          <span class={`t-caption-13 ${s === 'none' ? 'voice-caution' : 'muted'}`}>
            {s === 'ready' ? V.ready : s === 'pending' ? V.downloading : s === 'none' ? V.banglaNone : sub}
          </span>
        </span>
        {s === 'ready' && (
          <span class="voice-ready" role="img" aria-label={V.ready}>
            <Icon name="check" size={18} />
          </span>
        )}
        {s === 'download' && (
          <button type="button" class="btn btn--quiet voice-row__btn" onClick={() => void onDownload(l)}>
            {V.download}
          </button>
        )}
      </div>
    );
  };

  return (
    <div class="voice-setup" role="dialog" aria-modal="true" aria-labelledby="voice-setup-title" ref={ref} tabIndex={-1}>
      <div class="voice-setup__top">
        <button type="button" class="icon-btn" onClick={onClose} aria-label={t.common.close}>
          <Icon name="close" />
        </button>
      </div>
      <div class="voice-setup__body">
        <span class="voice-tile" aria-hidden="true">
          <Icon name="mic" size={28} />
        </span>
        <h2 id="voice-setup-title" class="voice-setup__title">
          {V.setupTitle}
        </h2>
        <p class="t-body-15 muted">{V.setupBody}</p>
        <div class="voice-list">
          <div class="voice-row">
            <span class="voice-row__text">
              <span class="t-body-strong-15">{V.mic}</span>
              <span class="t-caption-13 muted">{V.micSub}</span>
            </span>
            {micOk ? (
              <span class="voice-ready" role="img" aria-label={V.ready}>
                <Icon name="check" size={18} />
              </span>
            ) : (
              <button type="button" class="btn btn--quiet voice-row__btn" onClick={() => void onAllow()}>
                {V.allow}
              </button>
            )}
          </div>
          {row('bn-BD', V.bangla, V.banglaSub)}
          {row('en-US', V.english, V.banglaSub)}
        </div>
        {banglaOut && (
          <div class="voice-fallback">
            <p class="t-body-strong-14">{V.fallbackTitle}</p>
            <p class="t-caption-13 muted">{V.fallbackBody}</p>
          </div>
        )}
        <p class="voice-privacy voice-privacy--start">
          <Icon name="shield" size={18} />
          {V.privacy}
        </p>
      </div>
      <div class="voice-setup__foot">
        {banglaOut && lang === 'bn' ? (
          <button type="button" class="btn btn--primary btn--block" disabled={!canSpeak} onClick={() => onTry('en-US')}>
            {V.tryEnglish}
          </button>
        ) : (
          <button type="button" class="btn btn--primary btn--block" disabled={!canSpeak} onClick={() => onTry()}>
            {fmt(V.tryIt, { name: child!.name })}
          </button>
        )}
        <button type="button" class="btn btn--ghost btn--block voice-type" onClick={onType}>
          {V.typeInstead}
        </button>
      </div>
    </div>
  );
}
