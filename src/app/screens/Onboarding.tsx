import { useState } from 'preact/hooks';
import { useApp } from '../context';
import { Field, TextInput } from '../ui';
import { Chip } from '../../components/Chip';
import { go } from '../router';
import { rememberNoter } from '../actions';
import type { Lang } from '../../data/types';

/** Add a child in under two minutes: only the name is required. */
export function Onboarding({ adding }: { adding: boolean }) {
  const ctx = useApp();
  const { t, lang, repos, me } = ctx;
  const o = t.onboarding;
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [childLang, setChildLang] = useState<Lang>(lang);
  const [word, setWord] = useState('');
  const [mine, setMine] = useState(me);
  const [busy, setBusy] = useState(false);

  async function start(e: Event) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const c = await repos.children.add({
      name: name.trim(),
      birth_month: birth || null,
      language: childLang,
      photo: null,
      hard_moment_word: word.trim() || null,
    });
    if (mine.trim()) {
      await repos.settings.set('me', mine.trim());
      await rememberNoter(ctx, mine);
    }
    ctx.setChild(c.id);
    go('/today', true);
  }

  return (
    <main class="column app-screen onboarding">
      <form class="stack" style="--stack-gap: 20px" onSubmit={start}>
        <header class="stack" style="--stack-gap: 8px">
          <p class="wordmark" aria-hidden="true">
            dayline<span class="wordmark__dot" />
          </p>
          <h1 class="screen-title">{adding ? o.addAnother : o.title}</h1>
          <p class="t-body-15 muted">{o.body}</p>
        </header>
        <Field id="ob-name" label={o.name}>
          <TextInput id="ob-name" value={name} onValue={setName} required autoComplete="off" maxLength={60} data-autofocus />
        </Field>
        <Field id="ob-birth" label={o.birth} optional>
          <TextInput id="ob-birth" type="month" value={birth} onValue={setBirth} max={new Date().toISOString().slice(0, 7)} />
        </Field>
        <fieldset class="field">
          <legend class="field__label">{o.language}</legend>
          <div class="chip-group" role="radiogroup" aria-label={o.language}>
            <Chip mode="single" on={childLang === 'bn'} onClick={() => setChildLang('bn')}>
              <span lang="bn">বাংলা</span>
            </Chip>
            <Chip mode="single" on={childLang === 'en'} onClick={() => setChildLang('en')}>
              <span lang="en">English</span>
            </Chip>
          </div>
        </fieldset>
        <Field id="ob-word" label={o.word} hint={o.wordHint} optional>
          <TextInput id="ob-word" value={word} onValue={setWord} maxLength={30} autoComplete="off" />
        </Field>
        {!adding && (
          <Field id="ob-me" label={o.yourName} hint={o.yourNameHint} optional>
            <TextInput id="ob-me" value={mine} onValue={setMine} maxLength={30} autoComplete="off" />
          </Field>
        )}
        <button type="submit" class="btn btn--primary btn--block" disabled={!name.trim() || busy}>
          {o.start}
        </button>
        <p class="t-caption-13 muted center">{o.privacy}</p>
      </form>
    </main>
  );
}
