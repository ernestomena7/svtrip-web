// Brand button for the landing page.
//
// Ported from `SVTrip_Design_System/components/core/Button.jsx` — same variants
// (primary sunset gradient, secondary outline, accent gold, dark navy), same
// three sizes, same pill shape — but expressed against the Tailwind token
// mirror rather than the kit's inline styles. The design system's web kit is a
// prototype rendered through a global namespace; it cannot be imported, so this
// is the re-expression Principle VI's living-artifact clause calls for.
//
// It lives here rather than in `@svtrip/core` on purpose: core carries no
// layout-bearing components, so the mobile app's appearance can never be
// changed by an edit made for a web surface (FR-040).
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'accent' | 'dark';
type Size = 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-sunset text-white shadow-red',
  secondary: 'bg-surface text-text ring-[1.5px] ring-inset ring-border',
  accent: 'bg-gold-gradient text-navy shadow-gold',
  dark: 'bg-navy text-white shadow-md',
};

const SIZE: Record<Size, string> = {
  md: 'h-[46px] px-[22px] text-[15px] gap-2',
  lg: 'h-14 px-7 text-[17px] gap-2.5',
};

const BASE =
  // `whitespace-nowrap` is not cosmetic: these are fixed-height pills, so a label
  // that wraps to a second line overflows the button rather than growing it.
  // "Iniciar sesión" does exactly that at phone width.
  'inline-flex items-center justify-center whitespace-nowrap rounded-pill font-extrabold leading-none ' +
  'transition hover:brightness-105 active:scale-[0.96] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

function classes(variant: Variant, size: Size, fullWidth: boolean, extra?: string) {
  return [BASE, VARIANT[variant], SIZE[size], fullWidth ? 'w-full' : '', extra ?? '']
    .filter(Boolean)
    .join(' ');
}

interface Common {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  ...rest
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={classes(variant, size, fullWidth, className)} {...rest}>
      {children}
    </button>
  );
}

/**
 * The same button as a link.
 *
 * The landing's primary action navigates to another origin (the application), so
 * it must be a real anchor: a `<button onClick={location.assign}>` is invisible
 * to a crawler, cannot be opened in a new tab, and gives no destination on hover
 * — on a marketing page whose entire job is that one click, all three matter.
 */
export function ButtonLink({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  ...rest
}: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={classes(variant, size, fullWidth, className)} {...rest}>
      {children}
    </a>
  );
}
