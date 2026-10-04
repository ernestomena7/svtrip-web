// The first-run completion step (feature 011, US2).
//
// Google hands over an email and usually a name, and nothing else — no gender,
// age or country. This asks for what is missing, once, before the traveler
// reaches the rest of the product.
//
// It reaches accounts created through the email path too, which is not
// redundant: that form collects everything, but an account could still arrive
// here incomplete if a save half-failed. The gate asks "is anything missing",
// not "how did you sign up".
//
// No password fields, ever (FR-011). A Google account has none of the product's
// own, and this screen cannot know which kind it is looking at — nor should it
// need to.
import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_RESIDENCE_COUNTRY, missingProfileFields, validateProfileFields } from '@svtrip/shared';
import type { ProfileFieldError, RequiredProfileField } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { saveProfileFields } from '@svtrip/core/auth/userProfile';
import { Button, Card, ErrorState } from '../components/ui';
import { ProfileFieldsForm, fromProfile, toProfileFields, type ProfileFieldValues } from './ProfileFieldsForm';

export function CompleteProfileScreen() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [values, setValues] = useState<ProfileFieldValues>(() =>
    fromProfile(profile, DEFAULT_RESIDENCE_COUNTRY),
  );
  const [invalid, setInvalid] = useState<ProfileFieldError[]>([]);
  const [missing, setMissing] = useState<RequiredProfileField[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // Pre-fill from whatever Google supplied (FR-010). Google gives one full name,
  // so it is split on the first space — a reasonable guess the traveler can
  // correct, which is the whole point of leaving the fields editable.
  // Hydrated once, from the profile, when it actually arrives.
  //
  // `useState` runs its initializer on the FIRST render, when `profile` is
  // usually still null — so an account that already had a gender, an age, a
  // country or a marital status saw those fields empty, and either retyped them
  // or saved the defaults straight over the real values. Only firstName and
  // lastName were patched afterwards; every other stored field was dropped.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrated.current = true;
    setValues((prev) => {
      const stored = fromProfile(profile, DEFAULT_RESIDENCE_COUNTRY);
      // Anything already typed wins over the stored value: someone on this
      // screen may be here precisely to correct what is stored.
      const merged: ProfileFieldValues = { ...stored };
      for (const key of Object.keys(prev) as (keyof ProfileFieldValues)[]) {
        const typed = prev[key];
        if (typed) merged[key] = typed as never;
      }
      // Google supplies one full name; split it as a guess they can correct.
      if (!merged.firstName && !merged.lastName) {
        const parts = (profile.displayName ?? '').trim().split(/\s+/);
        merged.firstName = parts[0] ?? '';
        if (parts.length > 1) merged.lastName = parts.slice(1).join(' ');
      }
      return merged;
    });
  }, [profile]);

  async function submit() {
    const fields = toProfileFields(values);
    const nowMissing = missingProfileFields(fields);
    const nowInvalid = validateProfileFields(fields);
    setMissing(nowMissing);
    setInvalid(nowInvalid);
    // Unlike the profile screen, this step does NOT accept partial progress:
    // it exists to make the account complete, and letting it through half-done
    // would put the traveler back here on their next visit having achieved
    // nothing.
    if (nowMissing.length || nowInvalid.length || !user) return;

    setSaving(true);
    setFailed(false);
    try {
      await saveProfileFields(user.uid, fields);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-5 py-10">
      <Card className="w-full max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text">
            {t('account.completeTitle')}
          </h1>
          <p className="mt-2 text-sm text-muted">{t('account.completeSubtitle')}</p>
        </div>

        {failed && <ErrorState message={t('common.somethingWrong')} />}

        <ProfileFieldsForm values={values} onChange={setValues} invalid={invalid} missing={missing} />

        <Button onClick={() => void submit()} disabled={saving}>
          {t('account.save')}
        </Button>
      </Card>
    </div>
  );
}
