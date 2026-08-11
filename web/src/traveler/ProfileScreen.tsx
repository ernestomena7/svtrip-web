// Account screen (feature 007).
//
// Deliberately small: language, mode and sign-out. Everything a traveler does
// with their account lives here, and the desktop app has no reason to reinvent
// preferences the mobile app already owns.
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Language } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { signOutUser } from '@svtrip/core/auth/authService';
import { useUiStore } from '@svtrip/core/uiStore';
import { Button, Card, cx } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';

const LANGUAGES: Language[] = ['es', 'en'];

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);

  return (
    <DesktopLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
        {t('nav.profile')}
      </h1>

      <div className="mt-8 grid max-w-3xl gap-5">
        <Card className="flex items-center gap-4 bg-dusk p-6 text-white">
          <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white/15 font-display text-xl font-extrabold">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              (profile?.displayName ?? '?').slice(0, 1).toUpperCase()
            )}
          </span>
          <div>
            <p className="font-display text-lg font-extrabold">{profile?.displayName}</p>
            <p className="text-sm text-white/70">{profile?.email}</p>
          </div>
        </Card>

        <Card className="p-6">
          <p className="text-sm font-bold text-muted">{t('landing.language.label')}</p>
          <div className="mt-3 inline-flex rounded-pill bg-surface-2 p-1">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                aria-pressed={language === code}
                className={cx(
                  'rounded-pill px-4 py-2 text-sm font-bold transition',
                  language === code ? 'bg-surface text-text shadow-sm' : 'text-muted',
                )}
              >
                {t(`landing.language.${code}`)}
              </button>
            ))}
          </div>
        </Card>

        <Button
          variant="secondary"
          className="justify-self-start"
          onClick={() => void signOutUser().then(() => navigate('/'))}
        >
          {t('auth.signOut')}
        </Button>
      </div>
    </DesktopLayout>
  );
}
