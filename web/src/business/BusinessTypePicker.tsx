// What the business IS (feature 007, T103 — FR-032).
//
// Single choice, distinct from the multi-valued vibes below it in the form. The
// type drives which services are even offered — a shop is never asked about
// reservations — so `servicesFor()` owns that mapping rather than this component.
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BUSINESS_TYPES, mergeTaxonomyKeys, type BusinessType } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { useTaxonomy } from '@svtrip/core/taxonomy/useTaxonomy';
import { taxonomyLabeller } from '@svtrip/core/taxonomy/resolveTaxonomyLabel';
import { Chip } from '../components/ui';

export function BusinessTypePicker({
  value,
  onChange,
}: {
  value: BusinessType | undefined;
  onChange: (next: BusinessType) => void;
}) {
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);
  // Admin-managed additions and deactivations (feature 010). Merging in ONE
  // shared function rather than per-picker is what keeps a type from being
  // offered on this surface and missing on the phone.
  const { entries } = useTaxonomy('business-types');
  const types = useMemo(() => mergeTaxonomyKeys(BUSINESS_TYPES, entries), [entries]);
  const label = useMemo(
    () => taxonomyLabeller('business-types', entries, t, language),
    [entries, t, language],
  );

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-muted">{t('services.businessType')}</p>
      <p className="text-xs text-muted">{t('services.businessTypeHint')}</p>
      <div className="flex flex-wrap gap-2">
        {/* A business already classified with a since-deactivated type keeps
            showing it, so its owner can see what they have rather than an
            apparently-unset field they never changed (FR-006). */}
        {mergeTaxonomyKeys(types, []).concat(
          value && !types.includes(value) ? [value] : [],
        ).map((type) => (
          <Chip
            key={type}
            active={value === type}
            onClick={() => onChange(type as BusinessType)}
          >
            {label(type)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
