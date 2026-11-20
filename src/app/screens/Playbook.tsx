import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { useChildData } from '../data';
import { Field, ScreenHeader, TextInput } from '../ui';
import { Chip } from '../../components/Chip';
import { Icon } from '../../components/Icon';
import { fmt } from '../../i18n';
import { go } from '../router';
import { SITUATIONS, type Situation } from '../../data/types';

/** Which playbook situation a guide's lines belong to. */
export function situationFor(slug: string, category: string): Situation {
  if (slug === 'help-now' || category === 'hard-moments') return 'hard_moment';
  if (slug.includes('haircut')) return 'haircut';
  if (slug.includes('travel')) return 'travel';
  if (category === 'sleep') return 'sleep';
  if (category === 'food-gut') return 'food';
  return 'other';
}

export function Playbook() {
  const ctx = useApp();
  const { t, child, repos, lang } = ctx;
  const P = t.playbook;
  const data = useChildData();
  const [text, setText] = useState('');
  const [situation, setSituation] = useState<Situation>('hard_moment');
  const name = child!.name;

  async function add(e: Event) {
    e.preventDefault();
    if (!text.trim()) return;
    await repos.playbook.add({ child_id: child!.id, situation, text: text.trim(), guide_slug: null, sort: data.playbook.length, helped_count: 0 });
    setText('');
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 16px">
        <ScreenHeader title={fmt(P.title, { name })} backTo="/child" />
        <p class="t-body-14 muted">{P.intro}</p>
        {!data.playbook.length && <p class="empty-note t-body-14">{P.empty}</p>}
        {SITUATIONS.map((s) => {
          const items = data.playbook.filter((p) => p.situation === s);
          if (!items.length) return null;
          return (
            <section key={s} class="card">
              <h2 class="t-heading-17">{P.situations[s]}</h2>
              <ul class="list-plain playbook-list" role="list">
                {items.map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.text}
                      {p.helped_count > 0 && <span class="t-caption-13 muted"> · {fmt(P.helpedCount, { n: p.helped_count }, lang)}</span>}
                    </span>
                    <button
                      type="button"
                      class="icon-btn"
                      aria-label={`${t.common.delete}: ${p.text}`}
                      onClick={async () => {
                        await repos.playbook.remove(p.id);
                        ctx.toast(t.common.deleted, () => void repos.playbook.restore(p.id));
                      }}
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        <form class="card stack" style="--stack-gap: 12px" onSubmit={add}>
          <h2 class="t-heading-17">{P.add}</h2>
          <Field id="pb-text" label={P.newItem}>
            <TextInput id="pb-text" value={text} onValue={setText} maxLength={120} />
          </Field>
          <fieldset class="field">
            <legend class="field__label">{P.situation}</legend>
            <div class="chip-group" role="radiogroup" aria-label={P.situation}>
              {SITUATIONS.map((s) => (
                <Chip key={s} mode="single" on={situation === s} onClick={() => setSituation(s)}>
                  {P.situations[s]}
                </Chip>
              ))}
            </div>
          </fieldset>
          <button type="submit" class="btn btn--primary" disabled={!text.trim()}>
            {t.common.add}
          </button>
        </form>
      </main>
    </div>
  );
}

/** "Save to playbook" from a guide page: pick the lines that fit this child. */
export function PlaybookAdd({ slug }: { slug: string }) {
  const ctx = useApp();
  const { t, child, repos, lang } = ctx;
  const P = t.playbook;
  const data = useChildData();
  const guide = ctx.guides.find((g) => g.slug === slug && g.lang === lang) ?? ctx.guides.find((g) => g.slug === slug);
  const existing = new Set(data.playbook.map((p) => p.text));
  const [picked, setPicked] = useState<string[] | null>(null);
  const items = guide?.playbook_items ?? [];
  const chosen = picked ?? items.filter((i) => !existing.has(i));
  const name = child!.name;

  async function save() {
    if (!guide) return;
    const situation = situationFor(guide.slug, guide.category);
    let n = 0;
    for (const text of chosen.filter((i) => !existing.has(i))) {
      await repos.playbook.add({ child_id: child!.id, situation, text, guide_slug: guide.slug, sort: data.playbook.length + n, helped_count: 0 });
      n++;
    }
    ctx.toast(fmt(P.savedCount, { n }, lang));
    go('/playbook', true);
  }

  if (!guide) {
    return (
      <div class="app-screen">
        <main class="column app-main">
          <ScreenHeader title={fmt(P.title, { name })} backTo="/playbook" />
          <p class="empty-note">{P.guideMissing}</p>
        </main>
      </div>
    );
  }

  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 16px">
        <ScreenHeader title={fmt(P.pick, { name })} backTo="/playbook" />
        <p class="t-body-14 muted">{fmt(P.fromGuide, { title: guide.title })}</p>
        <ul class="list-plain pick-list" role="list">
          {items.map((i) => {
            const already = existing.has(i);
            const on = already || chosen.includes(i);
            return (
              <li key={i}>
                <label class={`check check--card ${already ? 'is-disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={already}
                    onChange={() => setPicked(on ? chosen.filter((x) => x !== i) : [...chosen, i])}
                  />
                  <span>
                    {i}
                    {already && <span class="t-caption-13 muted"> · {P.already}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <button type="button" class="btn btn--primary btn--block" disabled={!chosen.filter((i) => !existing.has(i)).length} onClick={() => void save()}>
          {fmt(P.saveSelected, { name })}
        </button>
      </main>
    </div>
  );
}
