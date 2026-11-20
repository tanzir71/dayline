import { useEffect, useState } from 'preact/hooks';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/today';
  const [path = '/today', qs = ''] = raw.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

/** Hash routing (#/today) so GitHub Pages never needs server routes. */
export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string, replace = false): void {
  const hash = `#${path}`;
  if (replace) history.replaceState(history.state, '', hash);
  else location.hash = hash;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function back(fallback = '/today'): void {
  if (history.length > 1 && document.referrer !== '') history.back();
  else go(fallback, true);
}
