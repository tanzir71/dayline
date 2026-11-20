import type { ComponentChildren } from 'preact';
import type { Tone } from './tones';

/** Category tile (Figma 2529:315): tinted tile with a tone dot, label and count. */
export function CategoryTile({
  href,
  tone = 'neutral',
  label,
  count,
}: {
  href: string;
  tone?: Tone;
  label: ComponentChildren;
  count: ComponentChildren;
}) {
  return (
    <a class={`category-tile tone-${tone}`} href={href}>
      <span class="category-tile__dot" aria-hidden="true" />
      <span class="category-tile__label t-body-strong-15">{label}</span>
      <span class="category-tile__count t-caption-13">{count}</span>
    </a>
  );
}
