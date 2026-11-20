import { useEffect, useState } from 'preact/hooks';
import { useApp } from '../context';
import { useChildData, sortedContacts } from '../data';
import { useNow } from '../live';
import { Icon } from '../../components/Icon';
import { fmt } from '../../i18n';
import { isoWithOffset } from '../../lib/time';
import { timeLabel, hardWord } from '../format';
import { saveMoment } from '../actions';
import { go } from '../router';

/** Help now with the child's playbook (2530:457): calm steps first, saving second. */
export function HelpNowApp() {
  const ctx = useApp();
  const { t, dict, lang, child, repos, emergency } = ctx;
  const H = dict.helpNow;
  const data = useChildData();
  const [started] = useState(() => new Date());
  const now = useNow(15_000);
  const [helped, setHelped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const mins = Math.max(0, Math.floor((now.getTime() - started.getTime()) / 60000));
  const plays = data.playbook.filter((p) => p.situation === 'hard_moment');
  const steps = ctx.helpSteps[lang]?.sections ?? [];
  const first = sortedContacts(data.contacts).find((c) => c.phone);
  const word = hardWord(child, ctx);

  useEffect(() => {
    document.body.classList.add('help-now');
    return () => document.body.classList.remove('help-now');
  }, []);

  async function over() {
    if (!child || busy) return;
    setBusy(true);
    const end = new Date();
    const n = Math.max(1, Math.round((end.getTime() - started.getTime()) / 60000));
    await saveMoment(
      ctx,
      {
        kind: 'hard_moment',
        started_at: isoWithOffset(started),
        ended_at: isoWithOffset(end),
        size: null,
        place: null,
        data: { parent_word: child.hard_moment_word ?? null, from_help_now: true },
        note: '',
        noted_by: ctx.me || null,
        source: 'help_now',
      },
      helped.map((tag) => ({ type: 'helped' as const, tag })),
    );
    for (const h of helped) {
      const item = plays.find((p) => p.text === h);
      if (item) await repos.playbook.update(item.id, { helped_count: item.helped_count + 1 });
    }
    ctx.toast(fmt(t.helpNow.saved, { word, n }, lang));
    go('/today', true);
  }

  return (
    <main id="main" class="column help help--app">
      <header class="help__top">
        <p class="overline help__overline">
          <span class="overline__dot" aria-hidden="true" />
          <span class="t-overline-12">{H.overline}</span>
        </p>
        <p class="help__clock t-caption-13">
          {fmt(H.started, { time: timeLabel(started, lang) })} · {fmt(H.elapsed, { n: mins }, lang)}
        </p>
      </header>
      <h1 class="help__title">{child ? fmt(H.titleNamed, { name: child.name }) : H.title}</h1>
      <p class="help__reassure">{H.reassure}</p>

      {child && (
        <section class="help__plays" aria-labelledby="works">
          <h2 id="works" class="help__h2">
            {fmt(t.helpNow.works, { name: child.name })}
          </h2>
          {plays.length ? (
            <ul class="plays" role="list">
              {plays.map((p) => {
                const on = helped.includes(p.text);
                return (
                  <li key={p.id} class="play">
                    <span class="play__text">{p.text}</span>
                    <button
                      type="button"
                      class={`play__btn ${on ? 'is-on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setHelped(on ? helped.filter((x) => x !== p.text) : [...helped, p.text])}
                    >
                      {on && <Icon name="check" size={18} />}
                      {t.helpNow.helped}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p class="help__footnote">{fmt(t.helpNow.emptyPlaybook, { name: child.name })}</p>
          )}
        </section>
      )}

      <section class="help__steps help__steps--app" aria-labelledby="general">
        <h2 id="general" class="help__h2">
          {t.helpNow.general}
        </h2>
        {steps.map((s) => (
          <div key={s.title}>
            <h3>{s.title}</h3>
            <ul>
              {s.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <div class="help__bar">
        {child && (
          <button type="button" class="btn btn--win btn--block help__over" onClick={() => void over()} disabled={busy}>
            {t.helpNow.over}
          </button>
        )}
        <div class={first ? 'help__bar-row' : 'help__bar-one'}>
          {first && (
            <a class="btn btn--on-light" href={`tel:${first.phone.replace(/[^0-9+]/g, '')}`}>
              <Icon name="phone" size={18} />
              {fmt(H.call, { name: first.name })}
            </a>
          )}
          <a class="btn btn--emergency-sm" href={`tel:${emergency.replace(/[^0-9+]/g, '')}`}>
            {fmt(H.emergency, { number: emergency })}
          </a>
        </div>
        {!child && (
          <a class="help__leave t-caption-13" href="#/today">
            {H.done}
          </a>
        )}
        {child && <p class="help__footnote t-caption-13 center">{fmt(t.helpNow.endNote, { word: word.toLowerCase() })}</p>}
        {child && (
          <a class="help__leave t-caption-13" href="#/today">
            {t.helpNow.leave}
          </a>
        )}
      </div>
    </main>
  );
}
