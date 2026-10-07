// Which business types a service applies to (feature 010's FR-009, now shared).
//
// EXTRACTED RATHER THAN COPIED (feature 019). The create form has rendered this
// control since 010; the row editor needs the same one. Copying it would put two
// parallel versions of the same picker on one screen — the thing Constitution
// Principle VI names explicitly — and they would drift the first time either is
// touched.
//
// It reads the live taxonomy itself rather than taking a list, because both
// callers need exactly the same list: the built-in types plus the ACTIVE ones a
// super admin added.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BUSINESS_TYPES } from '@svtrip/shared';
import { useTaxonomy } from '@svtrip/core/taxonomy/useTaxonomy';
import { cx } from '../components/ui';

export function ScopePicker({
  universal,
  types,
  onUniversalChange,
  onTypesChange,
}: {
  universal: boolean;
  types: readonly string[];
  onUniversalChange: (next: boolean) => void;
  onTypesChange: (next: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const { entries } = useTaxonomy('business-types');

  /** The authored label for an admin-created type, or undefined for a built-in. */
  const customTypeLabel = (key: string): string | undefined =>
    entries.find((e) => e.key === key)?.labelI18n?.[i18n.language === 'en' ? 'en' : 'es'];

  const typeChoices = useMemo(() => {
    const extra = entries.filter((e) => e.active && !BUSINESS_TYPES.includes(e.key as never));
    return [...BUSINESS_TYPES, ...extra.map((e) => e.key)];
  }, [entries]);

  return (
    <div className="space-y-2">
      <span className="block text-xs font-bold text-muted">{t('admin.scope')}</span>
      <div className="inline-flex rounded-pill bg-surface-2 p-1">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onUniversalChange(v)}
            aria-pressed={universal === v}
            className={cx(
              'rounded-pill px-4 py-2 text-sm font-bold transition',
              universal === v ? 'bg-surface text-text shadow-sm' : 'text-muted',
            )}
          >
            {v ? t('admin.scopeUniversal') : t('admin.scopeSpecific')}
          </button>
        ))}
      </div>
      {!universal && (
        <div className="flex flex-wrap gap-2 pt-1">
          {typeChoices.map((type) => {
            const on = types.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() =>
                  onTypesChange(on ? types.filter((x) => x !== type) : [...types, type])
                }
                aria-pressed={on}
                className={cx(
                  'rounded-pill border px-3 py-1.5 text-sm font-bold transition',
                  on
                    ? 'border-transparent bg-sunset text-white shadow-red'
                    : 'border-border bg-surface text-text hover:bg-surface-2',
                )}
              >
                {/* A built-in type has a translation key; one an admin created
                    has an authored label instead, and looking it up by key
                    printed the raw slug into the picker. */}
                {customTypeLabel(type) ?? t(`businessTypes.${type}`, type)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
