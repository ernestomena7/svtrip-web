// Password recovery request (feature 007, T066 — FR-012).
//
// Always reports success, whatever the provider said. Telling a visitor "no
// account with that email" is the same enumeration leak the sign-in screen
// refuses, on a screen that does not even require a password to probe.
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '@svtrip/core/auth/authService';
import { Button, Field, TextInput } from '../components/ui';
import { AuthShell } from './AuthShell';

export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await requestPasswordReset(email);
    } catch {
      /* Deliberately identical outcome — see the note above. */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <AuthShell
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.subtitle')}
      footer={
        <Link to="/sign-in" className="font-bold underline-offset-4 hover:underline">
          {t('auth.backToSignIn')}
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-2">
          <p className="font-display text-lg font-extrabold text-text">{t('auth.forgot.sentTitle')}</p>
          <p className="text-[15px] text-muted">{t('auth.forgot.sentBody')}</p>
        </div>
      ) : (
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
          <Button type="submit" fullWidth size="lg" disabled={busy}>
            {busy ? t('auth.loading') : t('auth.forgot.cta')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
