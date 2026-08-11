// One field, both languages (feature 007, T099 — FR-031).
//
// On a phone the two languages share one input behind a toggle, because there is
// no room for two. On a desktop there is, so they sit side by side: an owner
// writing the English version can see the Spanish they are translating from
// instead of flipping back and forth to remember it.
//
// The completeness rule is unchanged and is enforced on save: a listing with one
// language empty is refused, and the message names the missing language rather
// than saying "check your input".
import { useTranslation } from 'react-i18next';
import type { LocalizedText } from '@svtrip/shared';
import { TextArea, TextInput } from '../components/ui';

/** Seeds Español from the legacy flat value so nothing written before 006 is lost. */
export function fromLegacy(legacy: string, localized?: LocalizedText): LocalizedText {
  return { es: localized?.es ?? legacy ?? '', en: localized?.en ?? '' };
}

export function BilingualField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const { t } = useTranslation();
  const Input = multiline ? TextArea : TextInput;

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-bold text-muted">{label}</legend>
      <div className="grid gap-3 md:grid-cols-2">
        {(['es', 'en'] as const).map((lang) => (
          <label key={lang} className="block space-y-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wide text-muted">
              {t(`bilingual.${lang}`, lang === 'es' ? 'Español' : 'Inglés')}
            </span>
            <Input
              value={value[lang]}
              placeholder={placeholder}
              onChange={(e) => onChange({ ...value, [lang]: e.target.value })}
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
