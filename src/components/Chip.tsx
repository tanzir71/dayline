import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';

export type ChipState = 'default' | 'selected' | 'toggled';

type ChipProps = Omit<ButtonHTMLAttributes, 'role' | 'class'> & {
  /** 'single' renders a radio (Selected when on), 'multi' a toggle button (Toggled when on). */
  mode?: 'single' | 'multi';
  on?: boolean;
  children: ComponentChildren;
  class?: string;
};

/** Chip (Figma 2521:19): Default, Selected (single choice), Toggled (multi choice). 44 px tall. */
export function Chip({ mode = 'multi', on = false, children, class: cls, ...rest }: ChipProps) {
  const state: ChipState = on ? (mode === 'single' ? 'selected' : 'toggled') : 'default';
  const a11y = mode === 'single' ? { role: 'radio' as const, 'aria-checked': on } : { 'aria-pressed': on };
  return (
    <button type="button" class={['chip', `chip--${state}`, cls].filter(Boolean).join(' ')} {...a11y} {...rest}>
      {mode === 'multi' && on && (
        <svg class="chip__check" width="16" height="16" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <path d="M4.6 11.5 8.7 15.6 17.4 6.9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

/** Static chip-looking label (no interaction), e.g. tags. */
export function ChipLabel({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  return <span class={['chip', 'chip--default', 'chip--static', cls].filter(Boolean).join(' ')}>{children}</span>;
}
