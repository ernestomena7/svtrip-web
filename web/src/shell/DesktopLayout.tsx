// The signed-in shell (feature 007, T062).
//
// Persistent nav on top, content in a centred max-width column, navy footer —
// the arrangement `ui_kits/web/WebApp.jsx` specifies. Content is capped at
// 1280px rather than running edge to edge: a line of body text spanning a 1920px
// monitor is unreadable, and the design system's own web kit caps its grids too.
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CrashNotice, ErrorBoundary } from '../components/ErrorBoundary';
import { WebNav } from './WebNav';

const WORDMARK = '/svtrip-wordmark.png';

export function DesktopLayout({
  children,
  search,
  onSearchChange,
}: {
  children: ReactNode;
  search?: string;
  onSearchChange?: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <WebNav search={search} onSearchChange={onSearchChange} />
      {/* The backstop, INSIDE the layout on purpose. A boundary wrapped around
          the router instead would catch the same errors but take the header,
          the navigation and the footer down with the screen — a blank page with
          better wording. Here, a screen that throws leaves everything needed to
          navigate to a different one still on the page. */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-10 md:py-12">
        <ErrorBoundary label="screen" fallback={<CrashNotice />}>
          {children}
        </ErrorBoundary>
      </main>
      <footer className="bg-dusk">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-10">
          <img src={WORDMARK} alt="SVTrip" className="h-9 w-auto self-start" />
          <span className="text-[13px] font-bold text-white/70">{t('web.footer.tagline')}</span>
        </div>
      </footer>
    </div>
  );
}
