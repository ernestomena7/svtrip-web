// Register (feature 007, T066 — FR-012).
//
// Same error normalization as sign-in: never branch on a raw provider code.
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { mapAuthError, isPasswordLongEnough, MIN_PASSWORD_LENGTH } from '@svtrip/core/auth/authErrors';
import { registerWithEmail } from '@svtrip/core/auth/authService';
import { Button, Field, TextInput } from '../components/ui';
import { AuthShell } from './AuthShell';

export function RegisterScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordOk = isPasswordLongEnough(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordOk) return;
    setBusy(true);
    setError(null);
    try {
      await registerWithEmail(email, password);
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
        <p className="text-xs text-muted">
          {t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}
        </p>

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
