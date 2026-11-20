import en from './en.json';
import bn from './bn.json';
import type { Lang } from '../lib/paths';

export type Dict = typeof en;

const dicts: Record<Lang, Dict> = { en, bn: bn as Dict };

/** All UI strings for a language. Keys mirror the Figma copy; bn mirrors en exactly (see i18n.test.ts). */
export function getDict(lang: Lang): Dict {
  return dicts[lang];
}

/** Replace {name} placeholders. Numbers are written in the language's digits. */
export function fmt(template: string, vars: Record<string, string | number> = {}, lang: Lang = 'en'): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined) return `{${key}}`;
    return typeof v === 'number' ? formatNumber(v, lang) : v;
  });
}

export function formatNumber(n: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { maximumFractionDigits: 1 }).format(n);
}

/** Pick the singular, plural or zero string for a count. */
export function plural(n: number, forms: { one: string; other: string; zero?: string }, lang: Lang): string {
  if (n === 0 && forms.zero) return forms.zero;
  return fmt(n === 1 ? forms.one : forms.other, { n }, lang);
}

/** "Nov 2026" style month and year, in the page language. */
export function monthYear(isoDate: string, lang: Lang): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', { month: 'short', year: 'numeric' }).format(d);
}

export function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'bn' : 'en';
}
