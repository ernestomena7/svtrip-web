// Hero (feature 007, T044; photo background added by request).
//
// Follows `SVTrip_Design_System/ui_kits/web/WebHome.jsx`: gold eyebrow, oversized
// Poppins headline with tight tracking, supporting line, then the primary
// action — over a full-bleed photo with the kit's own left-to-right navy scrim
// (`linear-gradient(90deg, rgba(0,28,58,.85) 0%, rgba(0,28,58,.4) 50%,
// rgba(0,28,58,0) 100%)`), carried across verbatim rather than reinvented. This
// stacks to a readable column on a phone (FR-006).
//
// `bg-dusk` stays on the container as the layer UNDER the photo, not decoration:
// on a slow connection the navy gradient — and the text over it — is legible
// before the image ever arrives, the same never-blank-while-loading posture the
// showcase below takes with the catalog (FR-009a).
//
// The headline is the brand's own tagline. Sentence case with Spanish opening
// punctuation, never all-caps (Principle VI).
import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../components/Button';
import { APP_SIGN_IN_URL } from '../config';

export function Hero() {
  const { t } = useTranslation();

  return (
    <section className="px-5 pt-6 md:px-10 md:pt-8">
      <div className="relative overflow-hidden rounded-xl bg-dusk shadow-lg">
        {/* Generated with Higgsfield (nano_banana_2) at the user's request —
            not a stock photo. Eager and high-priority: this is the page's
            largest paint, so it must not compete with anything below the fold. */}
        <img
          src="/hero-beach.jpg"
          alt=""
          fetchPriority="high"
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,28,58,.85) 0%, rgba(0,28,58,.4) 50%, rgba(0,28,58,0) 100%)',
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 py-14 md:px-12 md:py-20">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">
            {t('landing.hero.eyebrow')}
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-3xl font-extrabold leading-[1.04] tracking-[-0.02em] text-white md:text-5xl">
            {t('landing.hero.title')}
          </h1>
          <p className="mt-4 max-w-xl text-base font-medium leading-relaxed text-white/90 md:text-lg">
            {t('landing.hero.subtitle')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href={APP_SIGN_IN_URL} size="lg">
              {t('landing.hero.cta')}
            </ButtonLink>
            <ButtonLink href="#como-funciona" variant="secondary" size="lg">
              {t('landing.hero.secondary')}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
