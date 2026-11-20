import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useCareData, useChildData, useEvents } from '../data';
import { Field, ScreenHeader, TextInput, Row } from '../ui';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { Overline } from '../../components/Overline';
import { fmt, plural } from '../../i18n';
import { addDays, dayOf, isoWithOffset, localDay } from '../../lib/time';
import { buildReport, reportPeriod, ReportView, ReportPages } from '../report';
import { ShareSheetBase } from './ShareSheet';
import { dateLabel, timeLabel } from '../format';
import { go, useRoute } from '../router';
import type { Prescriber, Visit, VisitPrep as Prep } from '../../data/types';

export function Prescribers() {
  const ctx = useApp();
  const { t } = ctx;
  const P = t.prescribers;
  const care = useCareData();
  const [editing, setEditing] = useState<Prescriber | 'new' | null>(null);
  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 16px">
        <ScreenHeader title={P.title} backTo="/child" />
        {!care.prescribers.length && !editing && <p class="empty-note t-body-14">{P.empty}</p>}
        <ul class="list-cards" role="list">
          {care.prescribers.map((p) =>
            editing !== 'new' && editing?.id === p.id ? (
              <li key={p.id}>
                <PrescriberForm p={p} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={p.id} class="card contact">
                <span>
                  <span class="t-body-strong-15">{p.name}</span>
                  <span class="t-caption-13 muted">{[p.specialty, p.clinic, p.phone].filter(Boolean).join(' · ')}</span>
                </span>
                <button type="button" class="btn btn--ghost btn--sm" onClick={() => setEditing(p)}>
                  {t.common.edit}
                </button>
              </li>
            ),
          )}
        </ul>
        {editing === 'new' ? (
          <PrescriberForm p={null} onDone={() => setEditing(null)} />
        ) : (
          <button type="button" class="btn btn--secondary btn--block" onClick={() => setEditing('new')}>
            <Icon name="plus" size={20} />
            {P.add}
          </button>
        )}
      </main>
    </div>
  );
}

function PrescriberForm({ p, onDone }: { p: Prescriber | null; onDone: (id?: string) => void }) {
  const ctx = useApp();
  const { t, child, repos } = ctx;
  const P = t.prescribers;
  const [name, setName] = useState(p?.name ?? '');
  const [specialty, setSpecialty] = useState(p?.specialty ?? '');
  const [clinic, setClinic] = useState(p?.clinic ?? '');
  const [phone, setPhone] = useState(p?.phone ?? '');
  async function save(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    const v = { name: name.trim(), specialty: specialty.trim(), clinic: clinic.trim(), phone: phone.trim() };
    if (p) {
      await repos.prescribers.update(p.id, v);
      onDone(p.id);
    } else onDone((await repos.prescribers.add({ ...v, child_id: child!.id })).id);
  }
  return (
    <form class="card stack" style="--stack-gap: 14px" onSubmit={save}>
      <Field id="pr-name" label={P.name}>
        <TextInput id="pr-name" value={name} onValue={setName} required maxLength={60} data-autofocus />
      </Field>
      <Field id="pr-spec" label={P.specialty} optional>
        <TextInput id="pr-spec" value={specialty} onValue={setSpecialty} placeholder={P.specialtyPlaceholder} maxLength={60} />
      </Field>
      <Field id="pr-clinic" label={P.clinic} optional>
        <TextInput id="pr-clinic" value={clinic} onValue={setClinic} maxLength={80} />
      </Field>
      <Field id="pr-phone" label={P.phone} optional>
        <TextInput id="pr-phone" type="tel" inputMode="tel" value={phone} onValue={setPhone} maxLength={20} />
      </Field>
      <div class="button-row">
        <button type="submit" class="btn btn--primary">
          {t.common.save}
        </button>
        <button type="button" class="btn btn--secondary" onClick={() => onDone()}>
          {t.common.cancel}
        </button>
        {p && (
          <button
            type="button"
            class="btn btn--ghost btn--danger"
            onClick={async () => {
              await repos.prescribers.remove(p.id);
              onDone();
            }}
          >
            {t.common.delete}
          </button>
        )}
      </div>
    </form>
  );
}

/** Visits: plan one, prep from memory, make the report. */
export function Visits() {
  const ctx = useApp();
  const { t, lang, child, repos } = ctx;
  const V = t.visits;
  const care = useCareData();
  const route = useRoute();
  const [adding, setAdding] = useState(route.query.get('add') === '1');
  const [who, setWho] = useState<string | null>(null);
  const [when, setWhen] = useState(() => `${addDays(localDay(), 7)}T10:00`);
  const [newDoc, setNewDoc] = useState(false);
  const now = new Date().toISOString();
  const upcoming = care.visits.filter((v) => v.scheduled_at >= now.slice(0, 10));
  const past = care.visits.filter((v) => v.scheduled_at < now.slice(0, 10)).reverse();
  const docName = (id: string | null) => care.prescribers.find((p) => p.id === id)?.name ?? V.someone;

  useEffect(() => {
    if (who === null && care.prescribers[0]) setWho(care.prescribers[0].id);
  }, [care.prescribers.length]);

  async function save(e: Event) {
    e.preventDefault();
    const v = await repos.visits.add({
      child_id: child!.id,
      prescriber_id: who,
      scheduled_at: isoWithOffset(new Date(when)),
      prep: null,
      questions: [],
      report_period_start: null,
    });
    setAdding(false);
    go(`/visit/${v.id}`);
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 16px">
        <ScreenHeader title={V.title} backTo="/insights" />
        {!upcoming.length && !adding && <p class="empty-note t-body-14">{V.none}</p>}
        {upcoming.length > 0 && (
          <ul class="guide-list card" role="list">
            {upcoming.map((v) => (
              <li key={v.id}>
                <Row
                  href={`#/visit/${v.id}`}
                  tone="medicine"
                  title={docName(v.prescriber_id)}
                  detail={`${dateLabel(new Date(v.scheduled_at), lang)} · ${timeLabel(new Date(v.scheduled_at), lang)}`}
                />
              </li>
            ))}
          </ul>
        )}
        {adding ? (
          <form class="card stack" style="--stack-gap: 14px" onSubmit={save}>
            <fieldset class="field">
              <legend class="field__label">{V.with}</legend>
              <div class="chip-group" role="radiogroup" aria-label={V.with}>
                {care.prescribers.map((p) => (
                  <Chip key={p.id} mode="single" on={who === p.id} onClick={() => setWho(p.id)}>
                    {p.name}
                  </Chip>
                ))}
                <button type="button" class="chip chip--default" onClick={() => setNewDoc(true)}>
                  + {t.prescribers.add}
                </button>
              </div>
            </fieldset>
            {newDoc && (
              <PrescriberForm
                p={null}
                onDone={(id) => {
                  setNewDoc(false);
                  if (id) setWho(id);
                }}
              />
            )}
            <Field id="vi-when" label={V.when}>
              <input id="vi-when" type="datetime-local" class="input" value={when} onInput={(e) => setWhen((e.currentTarget as HTMLInputElement).value)} required />
            </Field>
            <button type="submit" class="btn btn--primary">
              {V.save}
            </button>
          </form>
        ) : (
          <button type="button" class="btn btn--secondary btn--block" onClick={() => setAdding(true)}>
            <Icon name="plus" size={20} />
            {V.add}
          </button>
        )}
        {past.length > 0 && (
          <section class="stack" style="--stack-gap: 8px">
            <h2 class="t-heading-17">{V.past}</h2>
            <ul class="guide-list card" role="list">
              {past.map((v) => (
                <li key={v.id}>
                  <Row href={`#/visit/${v.id}/report`} tone="neutral" title={docName(v.prescriber_id)} detail={dateLabel(new Date(v.scheduled_at), lang)} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

/** Visit prep in 60 seconds (2530:706): four quick answers from memory, plus the parent's questions. */
export function VisitPrep({ id }: { id: string }) {
  const ctx = useApp();
  const { t, lang, child, repos } = ctx;
  const P = t.prep;
  const care = useCareData();
  const visit = care.visits.find((v) => v.id === id);
  const { events } = useEvents(addDays(localDay(), -120), localDay());
  const [prep, setPrep] = useState<Prep | null>(null);
  const [questions, setQuestions] = useState<string[] | null>(null);

  useEffect(() => {
    if (visit && prep === null) setPrep(visit.prep ?? { hard_moments: null, sleep: null, new_things: [] });
    if (visit && questions === null) setQuestions(visit.questions.length ? visit.questions : ['']);
  }, [visit?.id]);

  if (!care.ready) return null;
  if (!visit || !prep || !questions) {
    return (
      <div class="app-screen">
        <main class="column app-main">
          <ScreenHeader title={P.title} backTo="/visits" />
        </main>
      </div>
    );
  }
  const doc = care.prescribers.find((p) => p.id === visit.prescriber_id);
  const period = reportPeriod(visit, care.visits, events, child!.created_at, localDay());
  const loggedDays = new Set(events.filter((e) => dayOf(e.started_at) >= period.from).map((e) => dayOf(e.started_at))).size;

  async function make() {
    await repos.visits.update(visit!.id, { prep: prep!, questions: questions!.map((q) => q.trim()).filter(Boolean) });
    go(`/visit/${visit!.id}/report`);
  }

  const set = <K extends keyof Prep>(k: K, v: Prep[K]) => setPrep({ ...prep, [k]: v });

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 18px">
        <a class="back-link" href="#/visits">
          <Icon name="chevron-left" size={18} />
          {t.common.back}
        </a>
        <header class="stack" style="--stack-gap: 6px">
          <Overline tone="medicine">
            {(doc?.name ?? t.visits.someone) + ' · ' + dateLabel(new Date(visit.scheduled_at), lang) + ' ' + timeLabel(new Date(visit.scheduled_at), lang)}
          </Overline>
          <h1 class="screen-title">{P.title}</h1>
          <p class="t-body-15 muted">{P.body}</p>
        </header>
        <fieldset class="field">
          <legend class="field__label">{P.hard}</legend>
          <div class="chip-group" role="radiogroup" aria-label={P.hard}>
            {(['fewer', 'same', 'more'] as const).map((k) => (
              <Chip key={k} mode="single" on={prep.hard_moments === k} onClick={() => set('hard_moments', prep.hard_moments === k ? null : k)}>
                {P.hardOpts[k]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset class="field">
          <legend class="field__label">{P.sleep}</legend>
          <div class="chip-group" role="radiogroup" aria-label={P.sleep}>
            {(['better', 'same', 'worse'] as const).map((k) => (
              <Chip key={k} mode="single" on={prep.sleep === k} onClick={() => set('sleep', prep.sleep === k ? null : k)}>
                {P.sleepOpts[k]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset class="field">
          <legend class="field__label">{P.newThings}</legend>
          <div class="chip-group">
            {(Object.keys(P.newOpts) as (keyof typeof P.newOpts)[]).map((k) => (
              <Chip
                key={k}
                on={prep.new_things.includes(k)}
                onClick={() => set('new_things', prep.new_things.includes(k) ? prep.new_things.filter((x) => x !== k) : [...prep.new_things, k])}
              >
                {P.newOpts[k]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <fieldset class="field">
          <legend class="field__label">{P.questions}</legend>
          <div class="card stack" style="--stack-gap: 8px">
            {questions.map((q, i) => (
              <TextInput
                key={i}
                aria-label={`${P.questions} ${i + 1}`}
                value={q}
                placeholder={i === 0 ? P.questionPlaceholder : ''}
                maxLength={200}
                onValue={(v) => setQuestions(questions.map((x, j) => (j === i ? v : x)))}
              />
            ))}
            <button type="button" class="btn btn--ghost btn--sm" onClick={() => setQuestions([...questions, ''])}>
              + {P.addQuestion}
            </button>
          </div>
        </fieldset>
        <div class="stack" style="--stack-gap: 8px">
          <button type="button" class="btn btn--primary btn--block" onClick={() => void make()}>
            {P.make}
          </button>
          <p class="t-caption-13 muted center">{loggedDays ? fmt(P.uses, { n: loggedDays }, lang) : P.usesNone}</p>
        </div>
      </main>
    </div>
  );
}

/** The visit report on screen, with the share sheet for a two-page PDF, show, or print. */
export function VisitReportScreen({ id }: { id: string }) {
  const ctx = useApp();
  const { t, lang, child } = ctx;
  const R = t.report;
  const data = useChildData();
  const care = useCareData();
  const route = useRoute();
  const visit = care.visits.find((v) => v.id === id);
  const today = localDay();
  const { events, tags, ready } = useEvents(addDays(today, -160), today);
  const [shareOpen, setShareOpen] = useState(false);
  const showLang = route.query.get('lang');
  if (!care.ready || !ready || !data.ready) return null;
  if (!visit) {
    return (
      <div class="app-screen">
        <main class="column app-main">
          <ScreenHeader title={R.title} backTo="/visits" />
        </main>
      </div>
    );
  }
  const build = (l: typeof lang) => buildReport(ctx, l, data, visit, care.prescribers, care.visits, events, tags, care.changes, ctx.labels);
  const r = build(showLang === 'bn' || showLang === 'en' ? showLang : lang);
  return (
    <div class="app-screen report-screen">
      <header class="report-bar">
        <a class="back-link" href={`#/visit/${visit.id}`}>
          <Icon name="chevron-left" size={18} />
          {R.back}
        </a>
        <button type="button" class="btn btn--primary btn--sm" onClick={() => setShareOpen(true)}>
          <Icon name="share" size={18} />
          {R.share}
        </button>
      </header>
      <main id="main" class="report-wrap">
        <ReportView r={r} />
      </main>
      {shareOpen && (
        <ShareSheetBase
          title={R.shareTitle}
          subtitle={fmt(R.shareSub, { name: r.prescriber })}
          what="visit_report"
          fileWhat="visit-report"
          pdfTitle={(l) => fmt(build(l).t.report.pdfTitle, { name: child!.name })}
          pdfBody={R.pdfBody}
          showBody={R.showBody}
          show={(l) => {
            setShareOpen(false);
            go(`/visit/${visit.id}/report?lang=${l}`, true);
          }}
          pages={(l) => <ReportPages r={build(l)} />}
          initialLang={lang}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

/** "Visit with Dr. Rahman on Thursday · Prep in 60 seconds", three days before. */
export function visitNudge(visits: Visit[], today: string): Visit | undefined {
  return visits.find((v) => {
    const d = dayOf(v.scheduled_at);
    return d >= today && d <= addDays(today, 3) && !v.prep;
  });
}

export function visitCount(n: number, lang: 'en' | 'bn', forms: { one: string; other: string }) {
  return plural(n, forms, lang);
}
