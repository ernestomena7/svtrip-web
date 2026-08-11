// Sign in (feature 007, T066 — FR-012, FR-018b).
//
// Errors go through `mapAuthError` from `@svtrip/core` and are NEVER branched on
// raw Firebase codes. That is not tidiness: distinguishing "no such account"
// from "wrong password" in the UI turns this screen into an account-enumeration
// oracle, and feature 003 settled that deliberately. A second interface
// re-deciding it would quietly undo the decision.
//
// After signing in, the visitor returns to wherever the guard intercepted them
// (`?next=`), so a shared place link survives the detour (FR-018b).
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { mapAuthError } from '@svtrip/core/auth/authErrors';
import { signInWithEmail, signInWithGoogle } from '@svtrip/core/auth/authService';
import { Button, Field, TextInput } from '../components/ui';
import { AuthShell } from './AuthShell';
import { useReturnTo } from '../app/useReturnTo';

export function SignInScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const returnTo = useReturnTo();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      navigate(returnTo ?? '/discover', { replace: true });
    } catch (err) {
      setError(t(mapAuthError(err).messageKey));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(() => signInWithEmail(email, password));
  }

  return (
    <AuthShell
      title={t('auth.signInTitle')}
      subtitle={returnTo ? t('web.gated.body') : t('auth.signInSubtitle')}
      footer={
        <Link to="/register" className="font-bold underline-offset-4 hover:underline">
          {t('auth.register.link')}
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
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && (
          <p className="text-sm font-bold text-primary" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" disabled={busy}>
          {busy ? t('auth.loading') : t('auth.signInWithEmail')}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-border" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        variant="secondary"
        fullWidth
        size="lg"
        disabled={busy}
        onClick={() => void run(signInWithGoogle)}
      >
        {t('auth.signInWithGoogle')}
      </Button>

      <p className="mt-5 text-center">
        <Link to="/forgot-password" className="text-sm font-bold text-primary">
          {t('auth.forgot.title')}
        </Link>
      </p>
    </AuthShell>
  );
}
