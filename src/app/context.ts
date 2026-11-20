import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Dict } from '../i18n';
import type { DaylineDB } from '../data/db';
import type { Repos } from '../data/repos';
import type { Child, Lang } from '../data/types';
import type { LabelSummary } from '../domain/labels';

export interface GuideInfo {
  slug: string;
  lang: Lang;
  title: string;
  category: string;
  tone: string;
  read_minutes: number;
  playbook_items: string[];
  seasonal: string[];
  status: 'draft' | 'reviewed';
}

export interface HelpSteps {
  sections: { title: string; items: string[] }[];
}

export interface SeasonEvent {
  key: string;
  name: Record<Lang, string>;
  start: string;
  end: string;
  guides: string[];
}

export interface AppCtx {
  lang: Lang;
  dict: Dict;
  t: Dict['app'];
  db: DaylineDB;
  repos: Repos;
  base: string;
  /** Static site URL for a path in the current language. */
  site: (path: string) => string;
  child: Child | null;
  children: Child[];
  setChild: (id: string) => void;
  me: string;
  guides: GuideInfo[];
  helpSteps: Record<Lang, HelpSteps>;
  calendar: SeasonEvent[];
  labels: LabelSummary[];
  toast: (message: string, undo?: () => void) => void;
  emergency: string;
  flags: { playbook: boolean; insights: boolean };
}

export const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('App context missing');
  return c;
}
