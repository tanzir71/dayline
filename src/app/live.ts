import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/** Re-run a Dexie query whenever the tables it reads change. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue(v),
      error: (e) => console.error(e),
    });
    return () => sub.unsubscribe();
  }, deps);
  return value;
}

/** Re-render every `ms` so the "Now" marker and due doses stay current. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
