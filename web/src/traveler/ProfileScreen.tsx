// Account screen (feature 007, extended by feature 009).
//
// Language, moods of interest, mode and sign-out.
//
// The moods editor is NOT duplication of something the mobile app already owns
// (which is what this file's original comment claimed): this surface has no
// onboarding flow at all, so before feature 009 an account created here had an
// empty `preferences.vibes` and no screen anywhere on the web app to ever set
// one — while DiscoverScreen on this same surface was already reading that field
// to personalize "Para vos". This closes that gap.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Language } from '@svtrip/shared';
import {
  DEFAULT_RESIDENCE_COUNTRY,
  MOODS,
  missingProfileFields,
  validateProfileFields,
  type ProfileFieldError,
} from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { hasPasswordProvider, signOutUser } from '@svtrip/core/auth/authService';
import { saveProfileFields, updatePreferences } from '@svtrip/core/auth/userProfile';
import { useUiStore } from '@svtrip/core/uiStore';
import { Icon } from '@svtrip/core/Icon';
import { moodIcon } from '@svtrip/core/moodIcons';
import { useMergedTaxonomy } from '@svtrip/core/taxonomy/useTaxonomy';
import { Button, Card, Spinner, cx } from '../components/ui';
import { LANDING_URL } from '../config';
import { DesktopLayout } from '../shell/DesktopLayout';
import { useSuperAdmin } from '../admin/useSuperAdmin';
import { PasswordChangeCard } from '../account/PasswordChangeCard';
import {
  ProfileFieldsForm,
  fromProfile,
  toProfileFields,
  type ProfileFieldValues,
} from '../account/ProfileFieldsForm';

const LANGUAGES: Language[] = ['es', 'en'];

export function ProfileScreen() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  /** True from the moment sign-out starts until the browser leaves the app. */
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  // Visibility only — the route guard and the BFF are the actual boundary.
  const { isSuperAdmin } = useSuperAdmin();

  // Seeded from the profile once it arrives, then owned locally while editing —
  // unlike the moods pills below, which write on every tap. A form with six
  // fields needs an explicit save, or a half-typed surname would persist.
  const [values, setValues] = useState<ProfileFieldValues>(() =>
    fromProfile(profile, DEFAULT_RESIDENCE_COUNTRY),
  );
  const [seeded, setSeeded] = useState(false);
  const [invalid, setInvalid] = useState<ProfileFieldError[]>([]);
  const [savingFields, setSavingFields] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    if (seeded || !profile) return;
    setValues(fromProfile(profile, DEFAULT_RESIDENCE_COUNTRY));
    setSeeded(true);
  }, [profile, seeded]);

  // What the account has never been given. Drives the invitation only — it never
  // blocks the save, which is what lets an older account close its gaps a couple
  // of fields at a time (FR-020).
  const missing = missingProfileFields(profile ?? {});

  async function saveFields() {
    if (!user) return;
    const fields = toProfileFields(values);
    // Layer two only. Absence is allowed here on purpose: refusing a partial
    // save would trap an account that predates this feature behind six fields
    // it was never asked for (FR-018/FR-020). A value that IS present still has
    // to be valid (FR-021).
    const nowInvalid = validateProfileFields(fields);
    setInvalid(nowInvalid);
    setSavedOk(false);
    if (nowInvalid.length) return;

    setSavingFields(true);
    try {
      await saveProfileFields(user.uid, fields);
      setSavedOk(true);
    } finally {
      setSavingFields(false);
    }
  }

  // Straight from the subscribed profile, not a local mirror — see the same
  // note on the mobile ProfileScreen. It is what keeps one account's selection
  // identical on both surfaces without either one pushing to the other.
  const vibes = profile?.preferences.vibes ?? [];
  // Admin-managed moods (feature 010): additions appear here and
  // deactivations disappear, without a release.
  const { keys: moodKeys, label: moodLabel } = useMergedTaxonomy('moods', MOODS, vibes);

  async function toggleMood(mood: string) {
    if (!user) return;
    const selected = vibes.includes(mood);
    // FR-004: never let this editor empty the selection.
    if (selected && vibes.length === 1) return;
    const next = selected ? vibes.filter((m) => m !== mood) : [...vibes, mood];
    // Instant persist, no save button, and never `completeOnboarding` — this is
    // an ongoing preference edit, not a re-run of first-time onboarding (FR-007).
    await updatePreferences(user.uid, { vibes: next });
  }

  // Held while the sign-out request and the cross-origin navigation are in
  // flight, so the router's signed-out redirect never becomes visible.
  if (leaving) {
    return (
      <DesktopLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner label={t('auth.loading')} />
        </div>
      </DesktopLayout>
    );
  }

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

        {/* The traveler's own details (feature 011). The invitation above the
            form appears only when something is missing, blocks nothing, and
            disappears once the profile is complete (FR-019) — an account created
            before this feature is never stopped, only asked. */}
        <Card className="space-y-4 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-bold text-muted">{t('nav.profile')}</p>
            <p className="text-xs text-muted">{t('account.emailLocked')}</p>
          </div>

          {missing.length > 0 && (
            <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-text">
              {t('account.incompleteNotice', {
                fields: missing.map((f) => t(`account.${f === 'countryCode' ? 'country' : f}`)).join(', '),
              })}
            </p>
          )}

          <ProfileFieldsForm values={values} onChange={setValues} invalid={invalid} missing={[]} />

          {savedOk && <p className="text-sm font-bold text-text">{t('account.saved')}</p>}
          <Button disabled={savingFields} onClick={() => void saveFields()}>
            {t('account.save')}
          </Button>
        </Card>

        {/* Only for an account that HAS a password. A Google account has none of
            the product's own, so there would be nothing to change (FR-011). */}
        {hasPasswordProvider(user) && <PasswordChangeCard />}

        {/* Same pill vocabulary as the mobile app's editor and as onboarding —
            one choice, one visual language, whichever surface you change it on.
            The Card wrapper is this surface's own idiom (the language setting
            above uses one too); forcing both surfaces into identical container
            markup would make this look foreign next to its own neighbours. */}
        <Card className="p-6">
          <p className="text-sm font-bold text-muted">{t('profile.moods')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {moodKeys.map((mood) => {
              const active = vibes.includes(mood);
              // FR-004: the last remaining mood cannot be turned off.
              const locked = active && vibes.length === 1;
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => void toggleMood(mood)}
                  disabled={locked || !user}
                  aria-pressed={active}
                  className={cx(
                    'inline-flex items-center gap-2 rounded-pill border px-3.5 py-2 text-sm font-bold transition',
                    active
                      ? 'border-transparent bg-sunset text-white shadow-red'
                      : 'border-border bg-surface text-text hover:bg-surface-2',
                    locked && 'opacity-70',
                  )}
                >
                  <Icon name={moodIcon(mood)} size={15} />
                  {moodLabel(mood)}
                </button>
              );
            })}
          </div>
        </Card>

        {/* The way in to the taxonomy manager (feature 010).

            Gated on the CLAIM, not on a list of emails. Two accounts hold
            `svtripSuperAdmin` today, but granting a third is `npm run
            grant-super-admin` and nothing here changes — which is FR-003
            working rather than an exception to it. Hardcoding the two addresses
            would also put the answer to "who is an admin" in the client bundle,
            where anyone can read it and nobody can revoke it.

            Absent for everyone else, rather than present-and-disabled: a control
            that exists only to refuse you is worse than no control, and it
            advertises a screen the visitor has no business knowing about. The
            route itself is guarded too, and the BFF refuses every write
            regardless — this is the convenience, not the boundary. */}
        {isSuperAdmin && (
          <Button
            variant="secondary"
            className="justify-self-start"
            iconLeft="settings"
            onClick={() => navigate('/admin/taxonomy')}
          >
            {t('admin.openManager')}
          </Button>
        )}

        {/* Signing out leaves for the landing page, not the app's own root.
            Router `navigate` cannot do this: the landing is a separate
            deployment on a different origin, so it takes a real browser
            navigation.

            The redirect is chained AFTER signOutUser resolves, not fired
            alongside it: if the sign-out fails, staying put with a visible
            session is honest, whereas leaving for a public page while still
            authenticated would look signed out without being signed out.

            `leaving` exists because that ordering has a visible cost. The moment
            sign-out resolves, Firebase flips the auth state, the router swaps to
            its signed-out tree, and this gated route redirects to /sign-in — all
            before the browser has navigated away. The visitor saw a flash of the
            sign-in screen on their way out, which reads as "log back in" rather
            than "you have left". Holding this screen until the navigation
            actually happens removes it; a failed sign-out clears the flag and
            leaves the visitor exactly where they were. */}
        <Button
          variant="secondary"
          className="justify-self-start"
          disabled={leaving}
          onClick={() => {
            setLeaving(true);
            void signOutUser()
              .then(() => window.location.assign(LANDING_URL))
              .catch(() => setLeaving(false));
          }}
        >
          {t('auth.signOut')}
        </Button>
      </div>
    </DesktopLayout>
  );
}
