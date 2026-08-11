// "Qué es SVTrip" — an explicit product overview (feature 007 follow-up).
//
// The Hero hooks with the tagline and HowItWorks explains the mechanics, but
// neither states plainly what the product IS. A visitor who scrolls past the
// hero without reading closely should still be able to answer "what is this"
// from this section alone — that is the marketing-brief gap this section closes.
//
// Three stats rather than a wall of copy: concrete numbers read faster than
// adjectives, and they are the same claims the rest of the page backs up
// (curated catalog, bilingual parity, real places only).
import { useTranslation } from 'react-i18next';

const STATS = [
  { valueKey: 'landing.whatIs.stat1Value', labelKey: 'landing.whatIs.stat1Label' },
  { valueKey: 'landing.whatIs.stat2Value', labelKey: 'landing.whatIs.stat2Label' },
  { valueKey: 'landing.whatIs.stat3Value', labelKey: 'landing.whatIs.stat3Label' },
] as const;

export function WhatIsSVTrip() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-6xl px-5 pb-8 pt-16 md:px-10 md:pb-12 md:pt-24">
      <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-16">
        <div>
          <p className="eyebrow">{t('landing.whatIs.eyebrow')}</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-4xl">
            {t('landing.whatIs.title')}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted md:text-base">
            {t('landing.whatIs.body')}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-4 md:gap-6">
          {STATS.map((stat) => (
            <div key={stat.valueKey} className="rounded-lg bg-surface p-4 text-center shadow-md md:p-6">
              {/* The gradient-clipped wordmark treatment, reused here for big
                  numbers — the same signature the brand uses for standout
                  figures elsewhere in the design system. */}
              <dd className="text-sunset font-display text-2xl font-extrabold md:text-4xl">
                {t(stat.valueKey)}
              </dd>
              <dt className="mt-1.5 text-xs font-bold leading-tight text-muted md:text-sm">
                {t(stat.labelKey)}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
