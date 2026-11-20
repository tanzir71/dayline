import type { ComponentChildren } from 'preact';
import type { Tone } from './tones';

/** Guide row (Figma 2529:180): badge in the topic tone, title, meta, chevron. */
export function GuideRow({
  href,
  tone = 'neutral',
  title,
  meta,
  lang,
  onClick,
}: {
  href: string;
  tone?: Tone;
  title: ComponentChildren;
  meta?: ComponentChildren;
  lang?: string;
  onClick?: () => void;
}) {
  return (
    <a class={`guide-row tone-${tone}`} href={href} lang={lang} onClick={onClick}>
      <span class="guide-row__badge" aria-hidden="true">
        <span class="guide-row__dot" />
      </span>
      <span class="guide-row__text">
        <span class="guide-row__title t-body-strong-15">{title}</span>
        {meta && <span class="guide-row__meta t-caption-13">{meta}</span>}
      </span>
      <svg class="guide-row__chevron" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M6.75 4.5 11.25 9l-4.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </a>
  );
}
