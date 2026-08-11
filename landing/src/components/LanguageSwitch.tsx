// Language switch (feature 007, T049 — FR-005).
//
// Applies immediately and without a reload, which the constitution requires of
// every SVTrip surface. It writes to the same `uiStore` the mobile app uses, so
// a visitor who later signs in arrives with the language they chose here.
import { useTranslation } from 'react-i18next';
import type { Language } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';

const OPTIONS: Language[] = ['es', 'en'];

export function LanguageSwitch({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);

  const idle = tone === 'dark' ? 'text-white/70 hover:text-white' : 'text-muted hover:text-text';
  const active = tone === 'dark' ? 'bg-white/15 text-white' : 'bg-surface-2 text-text';

  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={t('landing.language.label')}>
      {OPTIONS.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-pressed={language === code}
          className={[
            'rounded-pill px-3 py-1.5 text-sm font-bold transition',
            language === code ? active : idle,
          ].join(' ')}
        >
          {t(`landing.language.${code}`)}
        </button>
      ))}
    </div>
  );
}
