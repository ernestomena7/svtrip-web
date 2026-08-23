// The traveler's own details, as a form (feature 011).
//
// One component, used by all three flows on this surface: registration, the
// first-run completion step, and the profile screen. Three copies of six fields
// and their rules would drift — and the rules are not cosmetic, they decide
// whether an account can be saved at all.
//
// Deliberately controlled-from-outside: it renders values and reports changes,
// and never saves. Each flow saves differently (create an account, complete a
// profile, patch an existing one), and a component that knew how to save would
// have to know which of the three it was inside.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Gender, MaritalStatus, ProfileFieldError, RequiredProfileField } from '@svtrip/shared';
import { GENDERS, MARITAL_STATUSES, MAX_AGE, MIN_AGE, parseAge } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { countryOptions } from '@svtrip/core/countries';
import { Field, Select, TextInput, cx } from '../components/ui';

export interface ProfileFieldValues {
  firstName: string;
  lastName: string;
  gender: Gender | '';
  /** Kept as the raw string the traveler typed, so "abc" can be rejected rather
   *  than silently becoming NaN on its way to a number. */
  age: string;
  countryCode: string;
  maritalStatus: MaritalStatus | '';
}

export function ProfileFieldsForm({
  values,
  onChange,
  invalid = [],
  missing = [],
}: {
  values: ProfileFieldValues;
  onChange: (next: ProfileFieldValues) => void;
  /** Fields whose entered value is unacceptable — highlighted after a failed save. */
  invalid?: ProfileFieldError[];
  /** Required fields left empty — named so the traveler is not left guessing. */
  missing?: RequiredProfileField[];
}) {
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);
  // Sorted in the display language, so a Spanish list reads alphabetically to a
  // Spanish speaker. Memoized: 249 entries with a locale-aware sort is not free.
  const countries = useMemo(() => countryOptions(language), [language]);

  const set = <K extends keyof ProfileFieldValues>(key: K, value: ProfileFieldValues[K]) =>
    onChange({ ...values, [key]: value });

  const flagged = (field: ProfileFieldError | RequiredProfileField) =>
    invalid.includes(field as ProfileFieldError) || missing.includes(field as RequiredProfileField);

  const errorRing = 'border-primary';

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label={t('account.firstName')}>
        <TextInput
          value={values.firstName}
          onChange={(e) => set('firstName', e.target.value)}
          className={cx(flagged('firstName') && errorRing)}
          autoComplete="given-name"
        />
      </Field>

      <Field label={t('account.lastName')}>
        <TextInput
          value={values.lastName}
          onChange={(e) => set('lastName', e.target.value)}
          className={cx(flagged('lastName') && errorRing)}
          autoComplete="family-name"
        />
      </Field>

      {/* Two options, so pills — the pattern the product already uses for every
          small fixed choice. A select for two items would be a heavier control
          for less information. */}
      <div className="space-y-1.5">
        <span className="block text-sm font-bold text-muted">{t('account.gender')}</span>
        <div className={cx('flex flex-wrap gap-2', flagged('gender') && 'rounded-pill ring-1 ring-primary')}>
          {GENDERS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set('gender', g)}
              aria-pressed={values.gender === g}
              className={cx(
                'inline-flex items-center rounded-pill border px-4 py-2 text-sm font-bold transition',
                values.gender === g
                  ? 'border-transparent bg-sunset text-white shadow-red'
                  : 'border-border bg-surface text-text hover:bg-surface-2',
              )}
            >
              {t(`account.genderOption.${g}`)}
            </button>
          ))}
        </div>
      </div>

      <Field label={t('account.age')}>
        <TextInput
          value={values.age}
          // `inputMode` gets the numeric keypad on a phone; the filter is what
          // actually enforces digits-only (FR-003), since inputMode is a hint a
          // hardware keyboard ignores entirely.
          inputMode="numeric"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '' || /^\d+$/.test(raw)) set('age', raw);
          }}
          className={cx(flagged('age') && errorRing)}
        />
        {invalid.includes('age') && (
          <span className="mt-1 block text-xs text-primary">
            {t('account.errors.ageRange', { min: MIN_AGE, max: MAX_AGE })}
          </span>
        )}
      </Field>

      <Field label={t('account.country')}>
        <Select
          value={values.countryCode}
          onChange={(e) => set('countryCode', e.target.value)}
          className={cx(flagged('countryCode') && errorRing)}
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      {/* Optional (FR-005), and it says so — otherwise an empty field next to
          five required ones reads as something the traveler forgot. Selecting an
          option a second time clears it, since there is no other way back to
          unset. */}
      <div className="space-y-1.5">
        <span className="block text-sm font-bold text-muted">
          {t('account.maritalStatus')}{' '}
          <span className="font-normal text-muted">· {t('account.maritalOptional')}</span>
        </span>
        <div className="flex flex-wrap gap-2">
          {MARITAL_STATUSES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => set('maritalStatus', values.maritalStatus === m ? '' : m)}
              aria-pressed={values.maritalStatus === m}
              className={cx(
                'inline-flex items-center rounded-pill border px-4 py-2 text-sm font-bold transition',
                values.maritalStatus === m
                  ? 'border-transparent bg-sunset text-white shadow-red'
                  : 'border-border bg-surface text-text hover:bg-surface-2',
              )}
            >
              {t(`account.maritalOption.${m}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** What the form holds, ready for the shared validators and the writer. */
export function toProfileFields(values: ProfileFieldValues) {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    ...(values.gender ? { gender: values.gender } : {}),
    ...(values.age ? { age: parseAge(values.age) } : {}),
    ...(values.countryCode ? { countryCode: values.countryCode } : {}),
    ...(values.maritalStatus ? { maritalStatus: values.maritalStatus } : {}),
  };
}

/** Seed the form from whatever a profile already holds. */
export function fromProfile(profile: {
  firstName?: string;
  lastName?: string;
  gender?: Gender;
  age?: number;
  countryCode?: string;
  maritalStatus?: MaritalStatus;
} | null | undefined,
  fallbackCountry: string,
): ProfileFieldValues {
  return {
    firstName: profile?.firstName ?? '',
    lastName: profile?.lastName ?? '',
    gender: profile?.gender ?? '',
    age: profile?.age !== undefined ? String(profile.age) : '',
    countryCode: profile?.countryCode ?? fallbackCountry,
    maritalStatus: profile?.maritalStatus ?? '',
  };
}
