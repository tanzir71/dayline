/** Base-path aware URLs. BASE_URL is '/' on a custom domain or '/repo/' on a project site. */
const BASE = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

export type Lang = 'en' | 'bn';
export const LANGS: Lang[] = ['en', 'bn'];

/** href('guides/') → '/dayline/guides/' */
export function href(path = ''): string {
  return BASE + path.replace(/^\/+/, '');
}

/** Language-prefixed page path: en lives at the root, bn under /bn/. */
export function localHref(lang: Lang, path = ''): string {
  return href((lang === 'bn' ? 'bn/' : '') + path.replace(/^\/+/, ''));
}

/** The same page in the other language: strips or adds the /bn/ prefix after the base. */
export function switchLangPath(pathname: string, to: Lang): string {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\/+/, '');
  const withoutBn = rest.replace(/^bn(\/|$)/, '');
  return localHref(to, withoutBn);
}

export const basePath = BASE;
