import type { VNode } from 'preact';

/** Inline stroke icons, 2 px stroke, round caps (paths from the Figma Nav bar and screens). */
export type IconName =
  | 'today'
  | 'guides'
  | 'insights'
  | 'child'
  | 'check'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'share'
  | 'search'
  | 'phone'
  | 'close'
  | 'menu'
  | 'print'
  | 'plus'
  | 'download'
  | 'clock'
  | 'arrow-right'
  | 'add-to-home'
  | 'ios-share'
  | 'mic'
  | 'keyboard'
  | 'shield';

const paths: Record<IconName, VNode> = {
  mic: (
    <>
      <path d="M11 2.75c1.66 0 3 1.34 3 3v4.5c0 1.66-1.34 3-3 3s-3-1.34-3-3v-4.5c0-1.66 1.34-3 3-3Z" stroke="currentColor" stroke-width="2" />
      <path d="M4.75 10.5a6.25 6.25 0 0 0 12.5 0M11 16.75v2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.75" y="5.5" width="16.5" height="11" rx="2" stroke="currentColor" stroke-width="2" />
      <path d="M6.5 9.25h.01M11 9.25h.01M15.5 9.25h.01M7.5 13h7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </>
  ),
  shield: (
    <>
      <path d="M11 2.75 4.58 5.5v5c0 4.13 2.75 7.33 6.42 8.75 3.67-1.42 6.42-4.62 6.42-8.75v-5L11 2.75Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
      <path d="m8.1 11 2.1 2.1 3.9-3.9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </>
  ),
  today: (
    <>
      <path d="M2.75 13.75H19.25" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="7.33" cy="13.75" r="1.83" fill="currentColor" />
      <circle cx="12.83" cy="13.75" r="1.83" fill="currentColor" />
      <circle cx="17.42" cy="8.25" r="2.29" fill="var(--brand-marigold)" />
    </>
  ),
  guides: (
    <>
      <path
        d="M4.58 4.13c0-.37.15-.72.4-.97s.61-.4.98-.4h11.46V16.5H5.96c-.37 0-.72.15-.98.4s-.4.61-.4.98V4.13Z"
        stroke="currentColor"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <path
        d="M4.58 17.88c0 .36.15.71.4.97s.61.4.98.4h11.46M8.25 6.88h5.5M8.25 10.08h3.67"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </>
  ),
  insights: (
    <path
      d="M3.67 17.42V8.25M9.17 17.42V4.58M14.67 17.42V11M20.17 17.42H1.83"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
  ),
  child: (
    <>
      <circle cx="11" cy="7.33" r="3.67" stroke="currentColor" stroke-width="2" />
      <path d="M4.13 19.25C5.04 15.58 7.79 13.75 11 13.75s5.96 1.83 6.88 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </>
  ),
  check: <path d="M4.6 11.5 8.7 15.6 17.4 6.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />,
  'chevron-right': <path d="M8.25 5.5 13.75 11l-5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />,
  'chevron-left': <path d="M13.75 5.5 8.25 11l5.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />,
  'chevron-down': <path d="M5.5 8.25 11 13.75l5.5-5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />,
  share: (
    <path
      d="M3.67 11v6.42c0 .5.4.91.91.91h12.84c.5 0 .91-.4.91-.91V11M11 2.75v11M14.67 6.42 11 2.75 7.33 6.42"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  ),
  'ios-share': (
    <path
      d="M7.5 8.5H6a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 6 19.5h10a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 16 8.5h-1.5M11 2.5v10M7.5 6 11 2.5 14.5 6"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  ),
  'add-to-home': (
    <>
      <rect x="3.5" y="3.5" width="15" height="15" rx="4" stroke="currentColor" stroke-width="1.9" />
      <path d="M11 7.5v7M7.5 11h7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
    </>
  ),
  search: (
    <>
      <circle cx="9.6" cy="9.6" r="6" stroke="currentColor" stroke-width="2" />
      <path d="m14.2 14.2 4.6 4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </>
  ),
  phone: (
    <path
      d="M6.2 3.2h2.3l1.4 3.6-1.8 1.2a9.6 9.6 0 0 0 5.9 5.9l1.2-1.8 3.6 1.4v2.3a2 2 0 0 1-2 2A14.8 14.8 0 0 1 4.2 5.2a2 2 0 0 1 2-2Z"
      stroke="currentColor"
      stroke-width="1.9"
      stroke-linejoin="round"
    />
  ),
  close: <path d="m6 6 10 10M16 6 6 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />,
  menu: <path d="M3.5 6.5h15M3.5 11h15M3.5 15.5h15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />,
  print: (
    <>
      <path d="M6.5 8V3.5h9V8M6.5 15.5h-2a1.5 1.5 0 0 1-1.5-1.5V9.5A1.5 1.5 0 0 1 4.5 8h13A1.5 1.5 0 0 1 19 9.5V14a1.5 1.5 0 0 1-1.5 1.5h-2" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" />
      <rect x="6.5" y="12.5" width="9" height="6" rx="1" stroke="currentColor" stroke-width="1.9" />
    </>
  ),
  plus: <path d="M11 4.5v13M4.5 11h13" stroke="currentColor" stroke-width="2" stroke-linecap="round" />,
  download: <path d="M11 3.5v10M7 9.5l4 4 4-4M4 17.5h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />,
  clock: (
    <>
      <circle cx="11" cy="11" r="7.5" stroke="currentColor" stroke-width="1.9" />
      <path d="M11 7v4.2l2.8 1.8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
    </>
  ),
  'arrow-right': <path d="M4.5 11h13M12.5 6l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />,
};

interface IconProps {
  name: IconName;
  size?: number;
  class?: string;
  /** Icons are decorative by default; pass a label only when the icon carries meaning on its own. */
  label?: string;
}

export function Icon({ name, size = 22, class: cls, label }: IconProps) {
  return (
    <svg
      class={['icon', cls].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={label ? undefined : 'true'}
      role={label ? 'img' : undefined}
      aria-label={label}
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
