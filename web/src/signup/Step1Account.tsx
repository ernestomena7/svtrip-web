// Feature 025, Step 1 of 2 — the account, created directly as a merchant (FR-010–FR-013).
//
// Two modes, one screen:
//   - `new`: signed out. Google, or email + password, plus feature 011's fields and the terms box.
//   - `complete`: signed in with an incomplete profile — a Google return, or an email account
//     interrupted inside this step (research R1b). The same fields and the terms box, no password.
//
// No Traveler/Merchant choice: the persona is set to `provider` here (R3 — it is UI state, not a role).
//
// The terms box does NOT gate the Google button: acceptance is recorded only for an account that
// exists, so a Google merchant is asked on return, in `complete` mode — never assumed from a click
// made before the account existed (R1b).
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  DEFAULT_RESIDENCE_COUNTRY,
  currentLegalVersions,
  missingProfileFields,
  validateProfileFields,
  type ProfileFieldError,
  type RequiredProfileField,
} from '@svtrip/shared';
import { mapAuthError, isPasswordLongEnough, MIN_PASSWORD_LENGTH } from '@svtrip/core/auth/authErrors';
import { registerWithEmail, signInWithGoogle } from '@svtrip/core/auth/authService';
import { auth } from '@svtrip/core/supabase';
import { recordTermsAcceptance, saveProfileFields, updatePreferences } from '@svtrip/core/auth/userProfile';
import { useUiStore } from '@svtrip/core/uiStore';
import { ProfileFieldsForm, fromProfile, toProfileFields, type ProfileFieldValues } from '../account/ProfileFieldsForm';
import { Button, Field, TextInput } from '../components/ui';
import { rememberSignupContext, type SignupContext } from './signupContext';
import { TermsCheckbox } from './TermsCheckbox';

export function Step1Account({
  mode,
  ctx,
  prefill,
  onStarted,
  onDone,
}: {
  mode: 'new' | 'complete';
  ctx: SignupContext;
  /** What Google already gave (name), for `complete` mode. */
  prefill?: Parameters<typeof fromProfile>[0];
  /** Fired once, on the first interaction (the funnel's `step1_started`, US4). */
  onStarted?: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const setPersona = useUiStore((s) => s.setPersona);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<ProfileFieldValues>(() => fromProfile(prefill ?? null, DEFAULT_RESIDENCE_COUNTRY));
  const [accepted, setAccepted] = useState(false);
  const [invalid, setInvalid] = useState<ProfileFieldError[]>([]);
  const [missing, setMissing] = useState<RequiredProfileField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [offerSignIn, setOfferSignIn] = useState(false);
  const [busy, setBusy] = useState(false);

  const passwordOk = mode === 'complete' || isPasswordLongEnough(password);
  const signInHref = `/sign-in?next=${encodeURIComponent(ctx.lang === 'en' ? '/en/business/register' : '/negocios/registro')}`;

  async function onGoogle() {
    onStarted?.();
    rememberSignupContext(ctx);
    setBusy(true);
    setError(null);
    try {
      // Redirects away; the provider returns to this path and the routing table resumes in `complete`.
      await signInWithGoogle();
    } catch (err) {
      setError(t(mapAuthError(err).messageKey));
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!accepted || !passwordOk) return;
    if (mode === 'new' && password !== confirm) {
      setError(t('account.errors.passwordMismatch'));
      return;
    }
    const profileFields = toProfileFields(fields);
    const nowMissing = missingProfileFields(profileFields);
    const nowInvalid = validateProfileFields(profileFields);
    setMissing(nowMissing);
    setInvalid(nowInvalid);
    if (nowMissing.length || nowInvalid.length) return;

    setBusy(true);
    setError(null);
    setOfferSignIn(false);
    try {
      if (mode === 'new') {
        rememberSignupContext(ctx);
        await registerWithEmail(email, password);
      }
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('no session');
      await saveProfileFields(uid, profileFields);
      const versions = currentLegalVersions();
      await recordTermsAcceptance(uid, { termsVersion: versions.terms, privacyVersion: versions.privacy });
      // The language the merchant is reading THIS page in becomes the account's. A new profile is born with
      // 'es', and the app copies a profile's stored language back over the screen's — so without this an
      // English merchant got Step 2 and the confirmation in Spanish (found by T033, 2026-11-25). Cosmetic, so
      // a failure here never undoes a registration that has already happened.
      await updatePreferences(uid, { language: ctx.lang }).catch(() => {});
      setLanguage(ctx.lang);
      setPersona('provider');
      onDone();
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(t(mapped.messageKey));
      // FR-013, without enumeration (feature 003): the same generic message a failed sign-up always
      // shows, plus the way in for someone who already has an account. Never "this email exists".
      if (mapped.code === 'registration_failed') setOfferSignIn(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div onFocusCapture={() => onStarted?.()}>
      {mode === 'new' && (
        <>
          <Button variant="secondary" fullWidth size="lg" disabled={busy} onClick={() => void onGoogle()}>
            {t('auth.register.withGoogle')}
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted">
            <span className="h-px flex-1 bg-border" />
            {t('auth.register.orEmail')}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {mode === 'new' && (
          <>
            <Field label={t('auth.email')}>
              <TextInput type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.emailPlaceholder')} />
            </Field>
            <Field label={t('auth.password')}>
              <TextInput type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label={t('account.confirmPassword')}>
              <TextInput type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            <p className="text-sm text-muted">{t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}</p>
          </>
        )}

        <ProfileFieldsForm values={fields} onChange={setFields} invalid={invalid} missing={missing} />

        <TermsCheckbox checked={accepted} onChange={setAccepted} />

        {error && (
          <div className="space-y-1" role="alert">
            <p className="text-sm font-bold text-primary">{error}</p>
            {offerSignIn && (
              <p className="text-sm text-text">
                {t('signup.step1.haveAccount')}{' '}
                <Link to={signInHref} className="font-bold underline underline-offset-2">
                  {t('signup.step1.signIn')}
                </Link>
              </p>
            )}
          </div>
        )}

        <Button type="submit" fullWidth size="lg" disabled={busy || !accepted || !passwordOk}>
          {busy ? t('auth.loading') : t('signup.step1.continue')}
        </Button>

        {mode === 'new' && (
          <p className="text-center text-sm text-muted">
            {t('signup.step1.haveAccount')}{' '}
            <Link to={signInHref} className="font-bold underline underline-offset-2">
              {t('signup.step1.signIn')}
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
