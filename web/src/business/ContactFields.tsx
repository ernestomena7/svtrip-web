// Contact numbers (feature 007, T102 — FR-032).
//
// Both optional, and that is the requirement, not laxity: a national park has no
// phone, and refusing to save one because a field is blank would be a bug. What
// IS validated is a number that was typed and is malformed — an unreachable
// contact button is worse than no contact button.
import { useTranslation } from 'react-i18next';
import { DEFAULT_COUNTRY_CODE, isValidPhone } from '@svtrip/shared';
import { Field, TextInput } from '../components/ui';

export function ContactFields({
  phone,
  whatsapp,
  onPhoneChange,
  onWhatsappChange,
}: {
  phone: string;
  whatsapp: string;
  onPhoneChange: (v: string) => void;
  onWhatsappChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const bad = !isValidPhone(phone) || !isValidPhone(whatsapp);

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-muted">{t('services.contactTitle')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t('services.phone')}>
          <TextInput
            inputMode="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder={`${DEFAULT_COUNTRY_CODE} 7000 0000`}
          />
        </Field>
        <Field label={t('services.whatsapp')}>
          <TextInput
            inputMode="tel"
            value={whatsapp}
            onChange={(e) => onWhatsappChange(e.target.value)}
            placeholder={`${DEFAULT_COUNTRY_CODE} 7000 0000`}
          />
        </Field>
      </div>
      {bad && <p className="text-xs font-bold text-primary">{t('services.phoneInvalid')}</p>}
      <p className="text-xs text-muted">{t('services.contactHint')}</p>
    </div>
  );
}
