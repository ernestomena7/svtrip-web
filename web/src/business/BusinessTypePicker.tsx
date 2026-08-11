// What the business IS (feature 007, T103 — FR-032).
//
// Single choice, distinct from the multi-valued vibes below it in the form. The
// type drives which services are even offered — a shop is never asked about
// reservations — so `servicesFor()` owns that mapping rather than this component.
import { useTranslation } from 'react-i18next';
import { BUSINESS_TYPES, type BusinessType } from '@svtrip/shared';
import { Chip } from '../components/ui';

export function BusinessTypePicker({
  value,
  onChange,
}: {
  value: BusinessType | undefined;
  onChange: (next: BusinessType) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-muted">{t('services.businessType')}</p>
      <p className="text-xs text-muted">{t('services.businessTypeHint')}</p>
      <div className="flex flex-wrap gap-2">
        {BUSINESS_TYPES.map((type) => (
          <Chip key={type} active={value === type} onClick={() => onChange(type)}>
            {t(`businessTypes.${type}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
