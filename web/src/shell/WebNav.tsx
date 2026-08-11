// Desktop navigation (feature 007, T061 — FR-010).
//
// From `SVTrip_Design_System/ui_kits/web/WebNav.jsx`: sticky, glass background
// with a blur, hairline bottom border, wordmark, text links, pill search, avatar.
//
// This is the single clearest break from the mobile app, and the point of the
// whole feature: navigation is persistent and always visible instead of a bottom
// tab bar. A bottom tab bar on a 1440px screen puts the primary controls as far
// from the content as the layout allows.
//
// Persona-aware, exactly as the mobile app is: a traveler and a business owner
// see different destinations, and an account that manages nothing is never
// offered the switch (FR-029).
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@svtrip/core/uiStore';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { Icon } from '@svtrip/core/Icon';
import { SearchInput, cx } from '../components/ui';
import { PersonaSwitch } from './PersonaSwitch';

const WORDMARK = '/svtrip-wordmark.png';

const TRAVELER = [
  { to: '/discover', key: 'nav.discover' },
  { to: '/guide', key: 'nav.guide' },
  { to: '/deals', key: 'nav.deals' },
  { to: '/saved', key: 'nav.saved' },
];

const BUSINESS = [
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/businesses', key: 'nav.services' },
  { to: '/subscription', key: 'nav.subscription' },
];

export function WebNav({
  search,
  onSearchChange,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const persona = useUiStore((s) => s.persona);
  const links = persona === 'provider' ? BUSINESS : TRAVELER;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center gap-6 px-5 md:px-10">
        <button
          type="button"
          onClick={() => navigate(persona === 'provider' ? '/dashboard' : '/discover')}
          className="shrink-0"
          aria-label="SVTrip"
        >
          <img src={WORDMARK} alt="SVTrip" className="h-9 w-auto" />
        </button>

        {/* Hidden on narrow screens: the same destinations live in the drawer
            below, and eight items in a 390px bar is not navigation. */}
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cx(
                  'text-[15px] transition',
                  isActive ? 'font-extrabold text-text' : 'font-bold text-muted hover:text-text',
                )
              }
            >
              {t(link.key)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {onSearchChange && (
            <div className="hidden w-[280px] lg:block">
              <SearchInput
                label={t('search.label', 'Buscar')}
                placeholder={t('search.placeholder', 'Buscá un plan, lugar o pueblo…')}
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
              />
            </div>
          )}

          <PersonaSwitch />

          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label={t('nav.profile')}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-muted ring-2 ring-transparent transition hover:ring-primary"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="user" size={18} />
            )}
          </button>
        </div>
      </div>

      {/* Narrow-screen destinations. FR-019a makes this the only web surface a
          phone browser can reach, so the links cannot simply disappear. */}
      <nav className="flex gap-1 overflow-x-auto border-t border-border px-5 py-2 md:hidden">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cx(
                'shrink-0 rounded-pill px-3.5 py-1.5 text-sm font-bold transition',
                isActive ? 'bg-sunset text-white shadow-red' : 'bg-surface-2 text-muted',
              )
            }
          >
            {t(link.key)}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
