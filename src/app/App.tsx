import { useEffect, useMemo, useState } from 'preact/hooks';
import { getDict } from '../i18n';
import { getDB, requestPersistence } from '../data/db';
import { createRepos } from '../data/repos';
import type { Child, Lang } from '../data/types';
import { Ctx, type AppCtx, type GuideInfo, type HelpSteps, type SeasonEvent } from './context';
import { useLive } from './live';
import { go, useRoute } from './router';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { QuickLog } from './screens/QuickLog';
import { HelpNowApp } from './screens/HelpNowApp';
import { About, ChildEdit, SectionEdit } from './screens/About';
import { Contacts } from './screens/Contacts';
import { Medicines, MedicineEdit } from './screens/Medicines';
import { Playbook, PlaybookAdd } from './screens/Playbook';
import { ShareSheet } from './screens/ShareSheet';
import { ShowMode } from './screens/ShowMode';
import { Settings } from './screens/Settings';
import { Insights } from './screens/Insights';
import { Prescribers, Visits, VisitPrep, VisitReportScreen } from './screens/Visits';
import { ChangeForm, ChangeReview } from './screens/Changes';
import { WelcomeBack } from './screens/WelcomeBack';
import { MedicineInfo } from './screens/MedicineInfo';
import { DayView } from './screens/DayView';
import { PassportShow } from './passport';
import { PassportShareSheet } from './screens/PassportShare';
import { NavBar } from './ui';
import type { LabelSummary } from '../domain/labels';

interface Props {
  lang: Lang;
  base: string;
  guides: GuideInfo[];
  helpSteps: Record<Lang, HelpSteps>;
  calendar: SeasonEvent[];
  labels: LabelSummary[];
  flags: { playbook: boolean; insights: boolean; desktop: boolean };
}

interface Toast {
  id: number;
  message: string;
  undo?: () => void;
}

export default function App(props: Props) {
  const { lang, base } = props;
  const dict = getDict(lang);
  const t = dict.app;
  const db = useMemo(() => getDB(), []);
  const repos = useMemo(() => createRepos(db), [db]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [childId, setChildId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const route = useRoute();

  useEffect(() => {
    (async () => {
      try {
        await db.open();
        void requestPersistence();
        // Carry over the emergency number chosen on the M0 Help now page.
        try {
          const old = localStorage.getItem('dayline.emergencyNumber');
          if (old && !(await db.settings.get('emergencyNumber'))) await repos.settings.set('emergencyNumber', old);
        } catch {
          /* no localStorage */
        }
        if (!(await db.settings.get('firstUse'))) await repos.settings.set('firstUse', new Date().toISOString());
        setChildId(await repos.settings.get<string | null>('currentChild', null));
        // Welcome back after 7 days away (M2): remember when the gap started, ask three questions once.
        const last = await repos.settings.get<string | null>('lastOpened', null);
        const gapDays = last ? (Date.now() - new Date(last).getTime()) / 86_400_000 : 0;
        if (props.flags.insights && gapDays >= 7 && (await db.child.count()) > 0) {
          await repos.settings.set('awaySince', last);
          go('/welcome', true);
        }
        await repos.settings.set('lastOpened', new Date().toISOString());
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, []);

  const children = useLive(() => repos.children.all(), [status], null as Child[] | null);
  const me = useLive(() => repos.settings.get('me', ''), [status], '');
  const emergency = useLive(() => repos.settings.get('emergencyNumber', '999'), [status], '999');

  const child = children?.find((c) => c.id === childId) ?? children?.[0] ?? null;

  const ctx: AppCtx = {
    lang,
    dict,
    t,
    db,
    repos,
    base,
    site: (path: string) => `${base}${lang === 'bn' ? 'bn/' : ''}${path}`,
    child,
    children: children ?? [],
    setChild: (id) => {
      setChildId(id);
      void repos.settings.set('currentChild', id);
    },
    me,
    guides: props.guides,
    helpSteps: props.helpSteps,
    calendar: props.calendar,
    labels: props.labels,
    emergency,
    flags: props.flags,
    toast: (message, undo) => {
      const id = Date.now() + Math.random();
      setToasts((ts) => [...ts, { id, message, undo }]);
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6000);
    },
  };

  useEffect(() => {
    document.documentElement.classList.toggle('show-mode', route.parts[0] === 'show' || route.parts[0] === 'passport');
  }, [route.path]);

  // Keyboard (M3): N logs a moment, D a dose, / searches guides; Esc closes sheets (in Sheet).
  useEffect(() => {
    if (!props.flags.desktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      const here = location.hash.replace(/^#/, '').split('?')[0] || '/today';
      if (/^\/(show|passport|help-now|onboarding|welcome)/.test(here) || document.querySelector('[role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if (key === 'n') {
        e.preventDefault();
        go(`/today?sheet=log&kind=hard_moment`);
      } else if (key === 'd') {
        e.preventDefault();
        go(`/today?sheet=log&kind=dose`);
      } else if (e.key === '/') {
        e.preventDefault();
        location.href = `${base}${lang === 'bn' ? 'bn/' : ''}guides/?focus=search`;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'error') {
    return (
      <main class="column app-message">
        <p class="t-body-15">{t.dbError}</p>
      </main>
    );
  }
  if (status === 'loading' || children === null) {
    return (
      <main class="column app-message" aria-busy="true">
        <p class="t-body-15 muted">{t.loading}</p>
      </main>
    );
  }

  const [section = 'today', a, b, c] = route.parts;
  const m2 = props.flags.insights;
  const sheet = route.query.get('sheet');
  const needsChild = !['help-now', 'onboarding', 'settings'].includes(section);

  let screen;
  if (section === 'onboarding' || (needsChild && !child)) {
    screen = <Onboarding adding={section === 'onboarding' && !!child} />;
  } else if (section === 'passport' && props.flags.desktop) {
    screen = <PassportShow lang={(a as Lang) ?? lang} />;
  } else if (section === 'show') {
    screen = <ShowMode briefLang={(a as Lang) ?? lang} />;
  } else if (section === 'help-now') {
    screen = <HelpNowApp />;
  } else if (section === 'child') {
    if (a === 'section' && b) screen = <SectionEdit section={b} />;
    else if (a === 'edit') screen = <ChildEdit />;
    else if (a === 'contacts') screen = <Contacts />;
    else if (a === 'medicines' && b && c === 'info' && m2) screen = <MedicineInfo id={b} />;
    else if (a === 'medicines' && b) screen = <MedicineEdit id={b} />;
    else if (a === 'prescribers' && m2) screen = <Prescribers />;
    else if (a === 'medicines') screen = <Medicines />;
    else screen = <About />;
  } else if (section === 'playbook') {
    screen = a === 'add' && b ? <PlaybookAdd slug={b} /> : <Playbook />;
  } else if (section === 'settings') {
    screen = <Settings />;
  } else if (section === 'insights') {
    screen = m2 ? (
      <Insights />
    ) : (
      <div class="app-screen with-nav">
        <main id="main" class="column app-main stack" style="--stack-gap: 12px">
          <h1 class="screen-title">{t.insights.title}</h1>
          <section class="card stack" style="--stack-gap: 8px">
            <p class="t-body-15">{t.insights.soon}</p>
            <p class="t-body-14 muted">{t.insights.meanwhile}</p>
          </section>
        </main>
        <NavBar active="insights" />
      </div>
    );
  } else if (m2 && section === 'visits') {
    screen = <Visits />;
  } else if (m2 && section === 'visit' && a && b === 'report') {
    screen = <VisitReportScreen id={a} />;
  } else if (m2 && section === 'visit' && a) {
    screen = <VisitPrep id={a} />;
  } else if (m2 && section === 'change' && a === 'new') {
    screen = <ChangeForm />;
  } else if (m2 && section === 'change' && a) {
    screen = <ChangeReview id={a} />;
  } else if (m2 && section === 'welcome') {
    screen = <WelcomeBack />;
  } else if (m2 && section === 'day' && a) {
    screen = <DayView day={a} />;
  } else if (section === 'log' || section === 'dose') {
    // Manifest shortcuts: open Today with the quick log on top.
    go(`/today?sheet=log&kind=${section === 'dose' ? 'dose' : 'hard_moment'}`, true);
    screen = <Today />;
  } else {
    screen = <Today />;
  }

  const closeSheet = () => go(route.path, true);

  return (
    <Ctx.Provider value={ctx}>
      {screen}
      {child && sheet === 'log' && section !== 'show' && (
        <QuickLog
          onClose={closeSheet}
          initialKind={route.query.get('kind') ?? 'hard_moment'}
          medicineId={route.query.get('medicine')}
          scheduleTime={route.query.get('time')}
        />
      )}
      {child && sheet === 'share' && section !== 'show' && <ShareSheet onClose={closeSheet} />}
      {child && sheet === 'passport' && props.flags.desktop && <PassportShareSheet onClose={closeSheet} />}
      <div class="toasts" role="status" aria-live="polite">
        {toasts.map((x) => (
          <div class="toast" key={x.id}>
            <span>{x.message}</span>
            {x.undo && (
              <button
                type="button"
                class="toast__undo"
                onClick={() => {
                  x.undo?.();
                  setToasts((ts) => ts.filter((y) => y.id !== x.id));
                }}
              >
                {t.common.undo}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
