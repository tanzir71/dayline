import type { ComponentChildren, InputHTMLAttributes, TextareaHTMLAttributes } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { Icon } from '../components/Icon';
import { useApp } from './context';
import { go } from './router';

/** Bottom sheet (Share brief sheet style, 2540:198): backdrop, grabber, Esc and focus kept inside. */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  labelledBy = 'sheet-title',
  class: cls,
}: {
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  labelledBy?: string;
  class?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Layout effect: Escape must work from the first frame the sheet is on screen.
  useLayoutEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    el?.querySelector<HTMLElement>('[data-autofocus], input, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) {
        const f = [...el.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select')].filter((x) => !x.hasAttribute('disabled'));
        const first = f[0];
        const last = f[f.length - 1];
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-sheet');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-sheet');
      prev?.focus?.();
    };
  }, []);
  return (
    <>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class={['sheet', 'app-sheet', cls].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>
        <div class="sheet__grabber" aria-hidden="true" />
        <div class="app-sheet__head">
          <div>
            <h2 id={labelledBy} class="sheet__title">
              {title}
            </h2>
            {subtitle && <div class="t-body-14 muted app-sheet__sub">{subtitle}</div>}
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div class="app-sheet__body">{children}</div>
        {footer && <div class="app-sheet__footer">{footer}</div>}
      </div>
    </>
  );
}

export function CloseButton({ onClick }: { onClick: () => void }) {
  const { t } = useApp();
  return (
    <button type="button" class="icon-btn" onClick={onClick}>
      <Icon name="close" />
      <span class="sr-only">{t.common.close}</span>
    </button>
  );
}

export function ScreenHeader({ title, backTo, action }: { title: ComponentChildren; backTo?: string; action?: ComponentChildren }) {
  const { t } = useApp();
  return (
    <header class="screen-head">
      {backTo && (
        <a class="back-link" href={`#${backTo}`}>
          <Icon name="chevron-left" size={18} />
          {t.common.back}
        </a>
      )}
      <div class="screen-head__row">
        <h1 class="screen-title">{title}</h1>
        {action}
      </div>
    </header>
  );
}

export function Field({
  label,
  hint,
  children,
  id,
  optional,
}: {
  label: ComponentChildren;
  hint?: ComponentChildren;
  children: ComponentChildren;
  id: string;
  optional?: boolean;
}) {
  const { t } = useApp();
  return (
    <div class="field">
      <label class="field__label" for={id}>
        {label}
        {optional && <span class="field__optional"> · {t.common.optional}</span>}
      </label>
      {children}
      {hint && <p class="field__hint t-caption-13">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes & { onValue?: (v: string) => void }) {
  const { onValue, class: cls, ...rest } = props;
  return <input class={['input', cls].filter(Boolean).join(' ')} {...rest} onInput={(e) => onValue?.((e.currentTarget as HTMLInputElement).value)} />;
}

export function TextArea(props: TextareaHTMLAttributes & { onValue?: (v: string) => void }) {
  const { onValue, class: cls, ...rest } = props;
  return <textarea class={['input', 'input--area', cls].filter(Boolean).join(' ')} {...rest} onInput={(e) => onValue?.((e.currentTarget as HTMLTextAreaElement).value)} />;
}

/** Nav bar (2521:253): Today, Guides, Insights, the child. */
export function NavBar({ active }: { active: 'today' | 'guides' | 'insights' | 'child' }) {
  const { t, child, site } = useApp();
  const tabs = [
    { key: 'today', href: '#/today', icon: 'today' as const, label: t.nav.today },
    { key: 'guides', href: site('guides/'), icon: 'guides' as const, label: t.nav.guides },
    { key: 'insights', href: '#/insights', icon: 'insights' as const, label: t.nav.insights },
    { key: 'child', href: '#/child', icon: 'child' as const, label: child?.name ?? '' },
  ];
  return (
    <nav class="nav-bar" aria-label={t.nav.main}>
      <a class="nav-bar__brand" href="#/today" aria-label="Dayline">
        dayline<span class="wordmark__dot" aria-hidden="true" />
      </a>
      {tabs.map((tab) => (
        <a key={tab.key} href={tab.href} class={tab.key === active ? 'is-active' : ''} aria-current={tab.key === active ? 'page' : undefined}>
          <Icon name={tab.icon} />
          <span>{tab.label}</span>
        </a>
      ))}
      <button type="button" class="nav-bar__install" data-install-desktop hidden>
        <Icon name="download" />
        <span>{t.install.desktop}</span>
      </button>
    </nav>
  );
}

/** Timeline item (2521:122): time, a coloured dot on the rail, title and detail. */
export function TimelineItem({
  time,
  tone,
  title,
  detail,
  now,
  planned,
  action,
}: {
  time: ComponentChildren;
  tone: string;
  title: ComponentChildren;
  detail?: ComponentChildren;
  now?: boolean;
  planned?: boolean;
  action?: ComponentChildren;
}) {
  return (
    <li class={['tl', `tone-${tone}`, now && 'tl--now', planned && 'tl--planned'].filter(Boolean).join(' ')}>
      <span class="tl__time">{time}</span>
      <span class="tl__rail" aria-hidden="true">
        <i />
      </span>
      <span class="tl__body">
        <span class="tl__title">{title}</span>
        {detail && <span class="tl__detail">{detail}</span>}
      </span>
      {action}
    </li>
  );
}

export function Row({ href, onClick, tone = 'neutral', title, detail }: { href?: string; onClick?: () => void; tone?: string; title: ComponentChildren; detail?: ComponentChildren }) {
  const inner = (
    <>
      <span class="guide-row__badge" aria-hidden="true">
        <span class="guide-row__dot" />
      </span>
      <span class="guide-row__text">
        <span class="guide-row__title t-body-strong-15">{title}</span>
        {detail && <span class="guide-row__meta t-caption-13">{detail}</span>}
      </span>
      <Icon name="chevron-right" size={18} class="guide-row__chevron" />
    </>
  );
  return href ? (
    <a class={`guide-row tone-${tone}`} href={href}>
      {inner}
    </a>
  ) : (
    <button type="button" class={`guide-row guide-row--button tone-${tone}`} onClick={onClick}>
      {inner}
    </button>
  );
}

export function goBackTo(path: string) {
  return () => go(path);
}
