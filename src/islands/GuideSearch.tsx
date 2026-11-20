import { useEffect, useRef, useState } from 'preact/hooks';
import { GuideRow } from '../components/GuideRow';
import { Icon } from '../components/Icon';
import type { Tone } from '../components/tones';

interface Strings {
  label: string;
  placeholder: string;
  searching: string;
  noResults: string;
  resultsCount: string;
  resultsOne: string;
  searchOffline: string;
  kindGuide: string;
  minutes: string;
  draft: string;
  reviewed: string;
}

interface Result {
  url: string;
  title: string;
  tone: Tone;
  meta: string;
}

interface PagefindResult {
  data: () => Promise<{ url: string; meta: Record<string, string> }>;
}
interface Pagefind {
  options: (o: Record<string, unknown>) => Promise<void>;
  debouncedSearch: (q: string, opts?: unknown, ms?: number) => Promise<{ results: PagefindResult[] } | null>;
}

const num = (n: number, lang: string) => new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-GB').format(n);

/** Guides search (Pagefind index built at build time, works offline once cached). */
export default function GuideSearch({ lang, base, s }: { lang: 'en' | 'bn'; base: string; s: Strings }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [results, setResults] = useState<Result[]>([]);
  const pf = useRef<Pagefind | null>(null);

  useEffect(() => {
    document.documentElement.toggleAttribute('data-searching', q.trim().length > 0);
  }, [q]);

  async function load(): Promise<Pagefind> {
    if (pf.current) return pf.current;
    const mod = (await import(/* @vite-ignore */ `${base}pagefind/pagefind.js`)) as Pagefind;
    await mod.options({ baseUrl: base });
    pf.current = mod;
    return mod;
  }

  async function search(value: string) {
    setQ(value);
    const query = value.trim();
    if (!query) {
      setResults([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    try {
      const engine = await load();
      const found = await engine.debouncedSearch(query, {}, 200);
      if (!found) return; // superseded by a newer keystroke
      const data = await Promise.all(found.results.slice(0, 12).map((r) => r.data()));
      setResults(
        data.map((d) => ({
          url: d.url,
          title: d.meta.title ?? '',
          tone: (d.meta.tone as Tone) ?? 'neutral',
          meta: [s.kindGuide, s.minutes.replace('{n}', num(Number(d.meta.minutes ?? 0), lang)), d.meta.status === 'reviewed' ? s.reviewed : s.draft].join(' · '),
        })),
      );
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  const count =
    results.length === 1 ? s.resultsOne : s.resultsCount.replace('{n}', num(results.length, lang));
  const message =
    status === 'loading'
      ? s.searching
      : status === 'error'
        ? s.searchOffline
        : status === 'done'
          ? results.length
            ? count
            : s.noResults.replace('{q}', q.trim())
          : '';

  return (
    <div class="guide-search" role="search">
      <label class="sr-only" for="guide-search-input">
        {s.label}
      </label>
      <div class="search-field">
        <Icon name="search" size={20} />
        <input
          id="guide-search-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder={s.placeholder}
          value={q}
          onFocus={() => void load().catch(() => undefined)}
          onInput={(e) => void search((e.currentTarget as HTMLInputElement).value)}
        />
      </div>
      <p class="guide-search__status t-caption-13" aria-live="polite">
        {message}
      </p>
      {q.trim() && results.length > 0 && (
        <ul class="guide-list card guide-search__results" role="list">
          {results.map((r) => (
            <li key={r.url}>
              <GuideRow href={r.url} tone={r.tone} title={r.title} meta={r.meta} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
