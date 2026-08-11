// Complete a password reset (feature 007, T066 — FR-012).
//
// This screen is WHY the router sits above the auth guard. The link arrives by
// email for a signed-out person, so `/reset-password?oobCode=…` has to be
// matchable with no session. Feature 003 shipped that fix on mobile after the
// link looked broken; the desktop app inherits the reasoning, not the bug.
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { completePasswordReset, verifyResetCode } from '@svtrip/core/auth/authService';
import { isPasswordLongEnough, mapAuthError, MIN_PASSWORD_LENGTH } from '@svtrip/core/auth/authErrors';
import { Button, Field, Spinner, TextInput } from '../components/ui';
import { AuthShell } from './AuthShell';

export function ResetPasswordScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const oobCode = params.get('oobCode') ?? '';

  const [state, setState] = useState<'checking' | 'ready' | 'invalid' | 'done'>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setState('invalid');
      return;
    }
    let cancelled = false;
    verifyResetCode(oobCode)
      .then(() => !cancelled && setState('ready'))
      .catch(() => !cancelled && setState('invalid'));
    return () => {
      cancelled = true;
    };
  }, [oobCode]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isPasswordLongEnough(password)) return;
    setBusy(true);
    setError(null);
    try {
      await completePasswordReset(oobCode, password);
      setState('done');
    } catch (err) {
      setError(t(mapAuthError(err).messageKey));
    } finally {
      setBusy(false);
    }
  }

  if (state === 'checking') {
    return (
      <AuthShell title={t('auth.reset.title')}>
        <Spinner label={t('auth.loading')} />
      </AuthShell>
    );
  }

  if (state === 'invalid') {
    return (
      <AuthShell title={t('auth.reset.invalidTitle')}>
        <Button fullWidth onClick={() => navigate('/forgot-password')}>
          {t('auth.reset.requestNew')}
        </Button>
      </AuthShell>
    );
  }

  if (state === 'done') {
    return (
      <AuthShell title={t('auth.reset.doneTitle')} subtitle={t('auth.reset.doneBody')}>
        <Button fullWidth onClick={() => navigate('/sign-in')}>
          {t('auth.reset.goSignIn')}
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('auth.reset.title')}
      footer={
        <Link to="/sign-in" className="font-bold underline-offset-4 hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label={t('auth.reset.newPassword')}>
          <TextInput
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted">{t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}</p>
        {error && (
          <p className="text-sm font-bold text-primary" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" fullWidth size="lg" disabled={busy || !isPasswordLongEnough(password)}>
          {busy ? t('auth.loading') : t('auth.reset.cta')}
        </Button>
      </form>
    </AuthShell>
  );
}
