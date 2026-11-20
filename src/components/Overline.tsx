import type { ComponentChildren } from 'preact';
import type { OverlineTone } from './tones';

/** Overline (Figma 2521:41): a tone dot and an uppercase label. 7 tones. */
export function Overline({
  tone = 'marigold',
  children,
  class: cls,
  as: Tag = 'p',
}: {
  tone?: OverlineTone;
  children: ComponentChildren;
  class?: string;
  as?: 'p' | 'span' | 'div' | 'h2' | 'h3';
}) {
  return (
    <Tag class={['overline', `tone-${tone}`, cls].filter(Boolean).join(' ')}>
      <span class="overline__dot" aria-hidden="true" />
      <span class="t-overline-12">{children}</span>
    </Tag>
  );
}
