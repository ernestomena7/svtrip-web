// Register (feature 007, T066 — FR-012).
//
// Same error normalization as sign-in: never branch on a raw provider code.
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { mapAuthError, isPasswordLongEnough, MIN_PASSWORD_LENGTH } from '@svtrip/core/auth/authErrors';
import { registerWithEmail, signInWithGoogle } from '@svtrip/core/auth/authService';
import { auth } from '@svtrip/core/firebase';
import { saveProfileFields } from '@svtrip/core/auth/userProfile';
import {
  DEFAULT_RESIDENCE_COUNTRY,
  missingProfileFields,
  validateProfileFields,
  type ProfileFieldError,
  type RequiredProfileField,
} from '@svtrip/shared';
import {
  ProfileFieldsForm,
  fromProfile,
  toProfileFields,
  type ProfileFieldValues,
} from '../account/ProfileFieldsForm';
import { Button, Field, TextInput } from '../components/ui';
import { AuthShell } from './AuthShell';

export function RegisterScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<ProfileFieldValues>(() =>
    fromProfile(null, DEFAULT_RESIDENCE_COUNTRY),
  );
  const [invalid, setInvalid] = useState<ProfileFieldError[]>([]);
  const [missing, setMissing] = useState<RequiredProfileField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordOk = isPasswordLongEnough(password);

  /**
   * Sign up with Google.
   *
   * Collects nothing here on purpose. Google supplies an email and usually a
   * name and nothing else, so the rest is asked for by the first-run completion
   * step in Router.tsx — which this account passes through anyway, and which
   * already pre-fills from what Google gave (feature 011, FR-009/FR-010).
   * Duplicating the six fields on this screen would mean asking twice.
   */
  async function onGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
      navigate('/discover', { replace: true });
    } catch (err) {
      setError(t(mapAuthError(err).messageKey));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordOk) return;

    // FR-008: two strings either match or they do not — nothing to ask the
    // server, and asking it would mean creating the account first.
    if (password !== confirm) {
      setError(t('account.errors.passwordMismatch'));
      return;
    }

    // FR-006: refuse with the missing fields NAMED, before the account exists.
    // Creating it first and completing afterwards would leave a half-made
    // account behind every abandoned form.
    const profileFields = toProfileFields(fields);
    const nowMissing = missingProfileFields(profileFields);
    const nowInvalid = validateProfileFields(profileFields);
    setMissing(nowMissing);
    setInvalid(nowInvalid);
    if (nowMissing.length || nowInvalid.length) return;

    setBusy(true);
    setError(null);
    try {
      await registerWithEmail(email, password);
      // Written immediately after creation, so the account is never observable
      // in an incomplete state — the first-run gate would otherwise catch the
      // traveler who just filled this form in and ask again.
      const uid = auth.currentUser?.uid;
      if (uid) await saveProfileFields(uid, profileFields);
      navigate('/discover', { replace: true });
    } catch (err) {
      setError(t(mapAuthError(err).messageKey));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      footer={
        <Link to="/sign-in" className="font-bold underline-offset-4 hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      }
    >
      <Button
        variant="secondary"
        fullWidth
        size="lg"
        disabled={busy}
        onClick={() => void onGoogle()}
      >
        {t('auth.register.withGoogle')}
      </Button>

      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-border" />
        {t('auth.register.orEmail')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t('auth.email')}>
          <TextInput
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.emailPlaceholder')}
          />
        </Field>
        <Field label={t('auth.password')}>
          <TextInput
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Field label={t('account.confirmPassword')}>
          <TextInput
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted">
          {t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}
        </p>

        {/* The same form the profile screen and the completion step render, so
            six fields and their rules exist once rather than three times. */}
        <ProfileFieldsForm
          values={fields}
          onChange={setFields}
          invalid={invalid}
          missing={missing}
        />

        {error && (
          <p className="text-sm font-bold text-primary" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" disabled={busy || !passwordOk}>
          {busy ? t('auth.loading') : t('auth.register.cta')}
        </Button>
      </form>
    </AuthShell>
  );
}
