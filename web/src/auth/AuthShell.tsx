// The frame every auth screen sits in (feature 007, T066).
//
// Centred card on the navy dusk gradient with the brand's soft sunset circles —
// the treatment `SignInScreen` uses on mobile, widened for a desktop viewport
// rather than reflowed into a phone column.
import type { ReactNode } from 'react';

const WORDMARK = '/svtrip-wordmark.png';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-dusk px-5 py-12">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sunset opacity-30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-gold-gradient opacity-20 blur-2xl" />

      <div className="relative w-full max-w-md">
        <img src={WORDMARK} alt="SVTrip" className="mx-auto h-12 w-auto" />
        <div className="mt-8 rounded-xl bg-surface p-7 shadow-lg md:p-9">
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-[15px] text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-white/80">{footer}</div>}
      </div>
    </div>
  );
}
