// Changing the password of a signed-in account (feature 011, FR-015/FR-016).
//
// Only rendered when the account actually has a password — a Google account has
// none of the product's own, so "current password" would have nothing to mean.
// The caller decides that with `hasPasswordProvider`; this component assumes it
// has already been asked.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changePassword } from '@svtrip/core/auth/authService';
import { MIN_PASSWORD_LENGTH, isPasswordLongEnough, mapPasswordChangeError } from '@svtrip/core/auth/authErrors';
import { Button, Card, Field, TextInput } from '../components/ui';

export function PasswordChangeCard() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const canSubmit = current && isPasswordLongEnough(next) && confirm && !busy;

  async function submit() {
    setError(null);
    setDone(false);
    // Checked here rather than server-side because there is nothing to ask the
    // server: two strings either match or they do not (FR-016).
    if (next !== confirm) {
      setError(t('account.errors.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      // Through the mapper, never the raw Firebase code — the rule
      // `authErrors.ts` exists to enforce. This mapper is the password-change
      // one, which may safely say "that current password is wrong" because the
      // traveler is already signed in; the sign-in mapper deliberately may not.
      setError(t(mapPasswordChangeError(err).messageKey));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <p className="text-sm font-bold text-muted">{t('account.changePassword')}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label={t('account.currentPassword')}>
          <TextInput
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <Field label={t('account.newPassword')}>
          <TextInput
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            placeholder={t('auth.passwordHint', { count: MIN_PASSWORD_LENGTH })}
          />
        </Field>
        <Field label={t('account.confirmPassword')}>
          <TextInput
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      </div>

      {error && <p className="text-sm font-bold text-primary">{error}</p>}
      {done && <p className="text-sm font-bold text-text">{t('account.passwordChanged')}</p>}

      <Button variant="secondary" disabled={!canSubmit} onClick={() => void submit()}>
        {t('account.savePassword')}
      </Button>
    </Card>
  );
}
