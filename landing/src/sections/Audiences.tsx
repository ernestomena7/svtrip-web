// The two audiences SVTrip serves (feature 007, T046/T047 — FR-004).
//
// Travelers and businesses, side by side, because the product has two personas
// and a landing that speaks to only one of them sends the other away. They share
// a component rather than being copy-pasted twice: the day the bullet styling
// changes, it changes for both.
//
// The business panel is the darker one and carries its own call to action —
// listing a business is a different decision from planning a weekend, and it
// deserves its own way in rather than being folded into the generic sign-in.
import { useTranslation } from 'react-i18next';
import { Icon } from '@svtrip/core/Icon';
import { ButtonLink } from '../components/Button';
import { APP_SIGN_IN_URL } from '../config';

function Bullets({ keys }: { keys: string[] }) {
  const { t } = useTranslation();
  return (
    <ul className="mt-6 space-y-3">
      {keys.map((key) => (
        <li key={key} className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0 text-primary">
            <Icon name="check" size={18} />
          </span>
          <span className="text-[15px] leading-relaxed">{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

export function Audiences() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 md:px-10 md:pb-24">
      <div className="grid gap-5 md:grid-cols-2 md:gap-6">
        {/* Travelers */}
        <div className="rounded-xl bg-surface p-7 text-text shadow-md md:p-9">
          <p className="eyebrow">{t('landing.travelers.eyebrow')}</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">
            {t('landing.travelers.title')}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{t('landing.travelers.body')}</p>
          <Bullets
            keys={[
              'landing.travelers.b1',
              'landing.travelers.b2',
              'landing.travelers.b3',
              'landing.travelers.b4',
            ]}
          />
        </div>

        {/* Businesses */}
        <div className="rounded-xl bg-dusk p-7 text-white shadow-lg md:p-9">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">
            {t('landing.businesses.eyebrow')}
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">
            {t('landing.businesses.title')}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/80">
            {t('landing.businesses.body')}
          </p>
          <div className="text-white/90">
            <Bullets
              keys={[
                'landing.businesses.b1',
                'landing.businesses.b2',
                'landing.businesses.b3',
                'landing.businesses.b4',
              ]}
            />
          </div>
          <ButtonLink href={APP_SIGN_IN_URL} variant="accent" className="mt-8">
            {t('landing.businesses.cta')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
