// Desktop UI primitives (feature 007, T063).
//
// Re-expressed from `SVTrip_Design_System/components/core/` against the shared
// Tailwind token mirror. The kit renders through a global namespace with inline
// styles and cannot be imported, which is the gap Principle VI's living-artifact
// clause asks to be recorded (see T116).
//
// Deliberately NOT shared with the mobile client. `@svtrip/core` carries no
// layout-bearing components precisely so a change made here for a wide screen
// can never alter the mobile app's appearance (FR-040). The two interfaces share
// tokens and icons — the things that must not drift — and nothing else.
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';
import { Icon, type IconName } from '@svtrip/core/Icon';

export function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ');
}

/* ── Button ──────────────────────────────────────────────────────────────── */

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'dark';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-sunset text-white shadow-red',
  secondary: 'bg-surface text-text ring-[1.5px] ring-inset ring-border',
  accent: 'bg-gold-gradient text-navy shadow-gold',
  ghost: 'bg-transparent text-primary',
  dark: 'bg-navy text-white shadow-md',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm gap-1.5',
  md: 'h-[46px] px-[22px] text-[15px] gap-2',
  lg: 'h-14 px-7 text-[17px] gap-2.5',
};

// `whitespace-nowrap` is load-bearing: these are fixed-height pills, so a label
// that wraps overflows the button instead of growing it.
const BTN_BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-pill font-extrabold leading-none ' +
  'transition hover:brightness-105 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

interface ButtonBits {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  iconLeft?: IconName;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  fullWidth,
  className,
  ...rest
}: ButtonBits & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx(BTN_BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {iconLeft && <Icon name={iconLeft} size={size === 'lg' ? 20 : 18} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft,
  fullWidth,
  className,
  ...rest
}: ButtonBits & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cx(BTN_BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className)}
      {...rest}
    >
      {iconLeft && <Icon name={iconLeft} size={size === 'lg' ? 20 : 18} />}
      {children}
    </a>
  );
}

/* ── Inputs ──────────────────────────────────────────────────────────────── */

const FIELD =
  'w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-text outline-none ' +
  'transition placeholder:text-muted focus:border-primary';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(FIELD, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={cx(FIELD, 'resize-y', props.className)} />;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Pill search input from `ui_kits/web/WebNav.jsx`. */
export function SearchInput({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
        <Icon name="search" size={18} />
      </span>
      <input
        type="search"
        aria-label={label}
        {...props}
        className={cx(
          'h-11 w-full rounded-pill border border-border bg-surface pl-10 pr-4 text-text outline-none',
          'transition placeholder:text-muted focus:border-primary',
          props.className,
        )}
      />
    </div>
  );
}

/* ── Surfaces ────────────────────────────────────────────────────────────── */

/** Borderless, soft warm-navy shadow. The design system bans bordered cards. */
export function Card({
  children,
  className,
  role,
}: {
  children: ReactNode;
  className?: string;
  role?: string;
}) {
  return (
    <div role={role} className={cx('rounded-lg bg-surface shadow-md', className)}>
      {children}
    </div>
  );
}

export function Chip({
  children,
  active,
  onClick,
  iconLeft,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  iconLeft?: IconName;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-pill border px-3.5 py-2 text-sm font-bold transition',
        active ? 'border-transparent bg-sunset text-white shadow-red' : 'border-border bg-surface text-text',
      )}
    >
      {iconLeft && <Icon name={iconLeft} size={14} />}
      {children}
    </button>
  );
}

/* ── The three states every screen owes the visitor (FR-016) ─────────────── */

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
      {label && <span className="text-sm font-bold text-muted">{label}</span>}
    </div>
  );
}

export function EmptyState({
  icon = 'compass',
  title,
  body,
  action,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon name={icon} size={24} />
      </span>
      <p className="font-display text-lg font-extrabold text-text">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center" role="alert">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-primary">
        <Icon name="bell" size={24} />
      </span>
      <p className="font-display text-lg font-extrabold text-text">{message}</p>
      {action}
    </div>
  );
}
