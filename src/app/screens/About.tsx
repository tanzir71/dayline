import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useCareData, useChildData, sectionLines, sortedContacts } from '../data';
import { NavBar, Row, ScreenHeader, TextArea, Field, TextInput } from '../ui';
import { Icon } from '../../components/Icon';
import { Chip } from '../../components/Chip';
import { fmt } from '../../i18n';
import { ageLabel } from '../format';
import { go } from '../router';
import { PROFILE_SECTIONS, type Lang, type ProfileSectionKey } from '../../data/types';

const SECTION_TONE: Record<string, string> = {
  communication: 'neutral',
  distress_signs: 'hard-moment',
  calms: 'win',
  avoid: 'hard-moment',
  medicines: 'medicine',
  food: 'food',
  sleep: 'sleep',
  contacts: 'neutral',
  other: 'neutral',
  prescribers: 'medicine',
  visits: 'medicine',
  changes: 'sleep',
};

/** About the child (2530:754): one-time profile that powers the brief. Every section optional. */
export function About() {
  const ctx = useApp();
  const { t, child } = ctx;
  const A = t.about;
  const data = useChildData();
  const care = useCareData();
  const name = child!.name;
  const preview = (key: string) => sectionLines(data.profile, key).join(', ');
  const anything = data.profile.some((p) => p.body.trim()) || data.contacts.length > 0 || data.medicines.length > 0;
  const rows: { key: string; href: string; detail: string }[] = [
    { key: 'communication', href: '#/child/section/communication', detail: preview('communication') },
    { key: 'distress_signs', href: '#/child/section/distress_signs', detail: preview('distress_signs') },
    { key: 'calms', href: '#/child/section/calms', detail: preview('calms') },
    { key: 'avoid', href: '#/child/section/avoid', detail: preview('avoid') },
    {
      key: 'medicines',
      href: '#/child/medicines',
      detail: data.medicines.filter((m) => m.active).map((m) => m.generic_name).join(', ') || A.noMedicines,
    },
    { key: 'food', href: '#/child/section/food', detail: preview('food') },
    { key: 'sleep', href: '#/child/section/sleep', detail: preview('sleep') },
    { key: 'contacts', href: '#/child/contacts', detail: sortedContacts(data.contacts).map((c) => c.name).join(', ') || A.noContacts },
    { key: 'other', href: '#/child/section/other', detail: preview('other') },
    ...(ctx.flags.insights
      ? [
          { key: 'prescribers', href: '#/child/prescribers', detail: care.prescribers.map((p) => p.name).join(', ') || A.noPrescribers },
          { key: 'visits', href: '#/visits', detail: care.visits.length ? `${care.visits.length}` : A.noVisits },
          { key: 'changes', href: '#/insights', detail: care.changes[0]?.summary ?? A.noChanges },
        ]
      : []),
  ];
  const sub = [ageLabel(child!.birth_month, ctx), child!.language === 'bn' ? t.common.langBn : t.common.langEn].filter(Boolean).join(' · ');

  return (
    <div class="app-screen with-nav">
      <header class="column profile-head">
        <span class="avatar avatar--lg" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 class="screen-title">{name}</h1>
          <p class="t-body-14 muted">{sub}</p>
        </div>
        <a class="icon-btn" href="#/child/edit" aria-label={fmt(A.edit, { name })}>
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M4 18h3.5L17 8.5 13.5 5 4 14.5V18Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" />
          </svg>
        </a>
      </header>
      <main id="main" class="column app-main stack" style="--stack-gap: 12px">
        <p class={`banner ${anything ? 'banner--ok' : ''}`}>
          {anything && <Icon name="check" size={18} />}
          <span>{anything ? fmt(A.ready, { name }) : fmt(A.readyEmpty, { name })}</span>
        </p>
        <ul class="guide-list card" role="list">
          {rows.map((r) => (
            <li key={r.key}>
              <Row href={r.href} tone={SECTION_TONE[r.key]} title={fmt(A.sections[r.key as keyof typeof A.sections], { name })} detail={r.detail || A.add} />
            </li>
          ))}
        </ul>
        <div class="button-row">
          <a class="btn btn--primary" href="#/child?sheet=share">
            {fmt(A.share, { name })}
          </a>
          {ctx.flags.desktop && (
            <a class="btn btn--secondary" href="#/child?sheet=passport">
              {t.passport.print}
            </a>
          )}
        </div>
        <a class="btn btn--secondary" href="#/playbook">
          {A.playbook}
        </a>
        <a class="btn btn--ghost" href="#/settings">
          {A.settings}
        </a>
      </main>
      <NavBar active="child" />
    </div>
  );
}

export function SectionEdit({ section }: { section: string }) {
  const ctx = useApp();
  const { t, child, repos } = ctx;
  const data = useChildData();
  const key = (PROFILE_SECTIONS as readonly string[]).includes(section) ? (section as ProfileSectionKey) : 'other';
  const existing = data.profile.find((p) => p.section === key);
  const [body, setBody] = useState<string | null>(null);
  useEffect(() => {
    if (body === null && existing) setBody(existing.body);
  }, [existing?.id]);
  const name = child!.name;
  const title = fmt(t.about.sections[key], { name });

  async function save(e: Event) {
    e.preventDefault();
    const text = (body ?? '').trim();
    if (existing) await repos.profile.update(existing.id, { body: text });
    else await repos.profile.add({ child_id: child!.id, section: key, body: text, sort: PROFILE_SECTIONS.indexOf(key) });
    ctx.toast(t.common.saved);
    go('/child');
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main">
        <form class="stack" style="--stack-gap: 16px" onSubmit={save}>
          <ScreenHeader title={title} backTo="/child" />
          <Field id="sec-body" label={title} hint={fmt(t.about.hints[key as keyof typeof t.about.hints] ?? '', { name })}>
            <TextArea id="sec-body" rows={8} value={body ?? ''} onValue={setBody} placeholder={t.about.placeholder} data-autofocus />
          </Field>
          <button type="submit" class="btn btn--primary btn--block">
            {t.common.save}
          </button>
        </form>
      </main>
    </div>
  );
}

export function ChildEdit() {
  const ctx = useApp();
  const { t, child, repos } = ctx;
  const C = t.child;
  const [name, setName] = useState(child!.name);
  const [birth, setBirth] = useState(child!.birth_month ?? '');
  const [childLang, setChildLang] = useState<Lang>(child!.language);
  const [word, setWord] = useState(child!.hard_moment_word ?? '');

  async function save(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;
    await repos.children.update(child!.id, { name: name.trim(), birth_month: birth || null, language: childLang, hard_moment_word: word.trim() || null });
    ctx.toast(t.common.saved);
    go('/child');
  }

  async function remove() {
    if (!confirm(fmt(C.removeConfirm, { name: child!.name }))) return;
    await repos.children.remove(child!.id);
    const rest = ctx.children.filter((c) => c.id !== child!.id);
    if (rest[0]) ctx.setChild(rest[0].id);
    go(rest.length ? '/today' : '/onboarding', true);
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main">
        <form class="stack" style="--stack-gap: 16px" onSubmit={save}>
          <ScreenHeader title={fmt(t.about.edit, { name: child!.name })} backTo="/child" />
          <Field id="ce-name" label={C.name}>
            <TextInput id="ce-name" value={name} onValue={setName} required maxLength={60} />
          </Field>
          <Field id="ce-birth" label={C.birth} optional>
            <TextInput id="ce-birth" type="month" value={birth} onValue={setBirth} />
          </Field>
          <fieldset class="field">
            <legend class="field__label">{C.language}</legend>
            <div class="chip-group" role="radiogroup" aria-label={C.language}>
              <Chip mode="single" on={childLang === 'bn'} onClick={() => setChildLang('bn')}>
                <span lang="bn">বাংলা</span>
              </Chip>
              <Chip mode="single" on={childLang === 'en'} onClick={() => setChildLang('en')}>
                <span lang="en">English</span>
              </Chip>
            </div>
          </fieldset>
          <Field id="ce-word" label={C.word} hint={t.onboarding.wordHint} optional>
            <TextInput id="ce-word" value={word} onValue={setWord} maxLength={30} />
          </Field>
          <button type="submit" class="btn btn--primary btn--block">
            {t.common.save}
          </button>
          <button type="button" class="btn btn--ghost btn--danger" onClick={() => void remove()}>
            {fmt(C.remove, { name: child!.name })}
          </button>
        </form>
      </main>
    </div>
  );
}

export { SECTION_TONE };
