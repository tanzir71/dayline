import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentChildren } from 'preact';

export type ButtonVariant = 'primary' | 'secondary' | 'hard-moment' | 'win' | 'dose' | 'ghost' | 'quiet';

type Common = {
  variant?: ButtonVariant;
  /** Fill the width of the container. */
  block?: boolean;
  size?: 'md' | 'sm';
  class?: string;
  children: ComponentChildren;
};

type AsLink = Common & Omit<AnchorHTMLAttributes, 'size' | 'class'> & { href: string };
type AsButton = Common & Omit<ButtonHTMLAttributes, 'size' | 'class'> & { href?: undefined };

export type ButtonProps = AsLink | AsButton;

/** Button (Figma 2521:12): Primary, Secondary, Hard moment, Win, Dose. 52 px tall, radius 16. */
export function Button(props: ButtonProps) {
  const { variant = 'primary', block, size = 'md', class: cls, children, ...rest } = props;
  const className = ['btn', `btn--${variant}`, size === 'sm' && 'btn--sm', block && 'btn--block', cls]
    .filter(Boolean)
    .join(' ');
  if ('href' in rest && rest.href !== undefined) {
    return (
      <a class={className} {...(rest as AnchorHTMLAttributes)}>
        {children}
      </a>
    );
  }
  const buttonRest = rest as ButtonHTMLAttributes;
  return (
    <button type="button" class={className} {...buttonRest}>
      {children}
    </button>
  );
}
