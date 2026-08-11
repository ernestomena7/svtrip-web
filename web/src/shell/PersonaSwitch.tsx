// Traveler ⇄ Business switch (feature 007, T095 — FR-029).
//
// Two rules carried over from the mobile app, both load-bearing:
//   - it changes mode WITHOUT signing out or asking for credentials again;
//   - an account that manages no business never sees it at all. Offering the
//     switch to every account was the defect feature 006 fixed; showing it here
//     would reintroduce it on a new surface.
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@svtrip/core/uiStore';
import { useManagedBusinesses } from '@svtrip/core/repos/useManagedBusinesses';
import { cx } from '../components/ui';

export function PersonaSwitch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const persona = useUiStore((s) => s.persona);
  const setPersona = useUiStore((s) => s.setPersona);
  const { listings } = useManagedBusinesses();

  // `undefined` while loading — render nothing rather than flashing a control
  // that may not belong to this account.
  if (!listings || listings.length === 0) return null;

  function choose(next: 'traveler' | 'provider') {
    setPersona(next);
    navigate(next === 'provider' ? '/dashboard' : '/discover');
  }

  return (
    <div className="hidden rounded-pill bg-surface-2 p-1 sm:flex" role="group" aria-label={t('profile.persona')}>
      {(['traveler', 'provider'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          aria-pressed={persona === value}
          className={cx(
            'rounded-pill px-3.5 py-1.5 text-sm font-bold transition',
            persona === value ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
          )}
        >
          {t(value === 'traveler' ? 'profile.traveler' : 'profile.provider')}
        </button>
      ))}
    </div>
  );
}
