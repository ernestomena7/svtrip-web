// How it works (feature 007, T045 — FR-002).
//
// Answers "what does this thing actually do" before asking for anything. Three
// steps, because the product really is three steps, and the middle one carries
// the promise that distinguishes SVTrip from a search engine: the guide
// recommends real catalog places and never invents one.
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@svtrip/core/Icon';

const STEPS: { icon: IconName; titleKey: string; bodyKey: string }[] = [
  { icon: 'compass', titleKey: 'landing.how.step1Title', bodyKey: 'landing.how.step1Body' },
  { icon: 'sparkles', titleKey: 'landing.how.step2Title', bodyKey: 'landing.how.step2Body' },
  { icon: 'navigation', titleKey: 'landing.how.step3Title', bodyKey: 'landing.how.step3Body' },
];

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-5 pb-16 pt-8 md:px-10 md:pb-24 md:pt-12">
      <p className="eyebrow">{t('landing.how.eyebrow')}</p>
      <h2 className="mt-2 max-w-2xl font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-4xl">
        {t('landing.how.title')}
      </h2>

      <ol className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
        {STEPS.map((step, i) => (
          <li key={step.titleKey} className="rounded-lg bg-surface p-6 shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sunset text-white shadow-red">
              <Icon name={step.icon} size={22} />
            </div>
            {/* The step number is decorative — the ordered list already carries
                the sequence for anything reading this without styles. */}
            <p className="mt-5 text-sm font-extrabold text-muted" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </p>
            <h3 className="mt-1 font-display text-lg font-extrabold text-text">{t(step.titleKey)}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{t(step.bodyKey)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
