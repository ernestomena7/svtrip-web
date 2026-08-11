// Testimonials (feature 007 follow-up).
//
// ⚠️ ILLUSTRATIVE CONTENT — not real customer quotes. SVTrip has no testimonial
// pipeline yet (no review-collection flow feeding the landing, no consent
// process for using a traveler's words in marketing). These three are
// placeholder copy in the brand voice, sized and shaped like the real thing
// will be, with an explicit on-page disclaimer so nothing here reads as a
// fabricated claim about real people. Swap for real quotes — and drop the
// disclaimer — the moment there is a real pipeline.
//
// One quote from each side of the product (two travelers, one business owner),
// because "what people say" has two audiences and only showing one half of it
// undersells the business pitch two sections up.
import { useTranslation } from 'react-i18next';

const TESTIMONIALS = [
  { quoteKey: 'landing.testimonials.quote1', nameKey: 'landing.testimonials.name1', roleKey: 'landing.testimonials.role1' },
  { quoteKey: 'landing.testimonials.quote2', nameKey: 'landing.testimonials.name2', roleKey: 'landing.testimonials.role2' },
  { quoteKey: 'landing.testimonials.quote3', nameKey: 'landing.testimonials.name3', roleKey: 'landing.testimonials.role3' },
] as const;

export function Testimonials() {
  const { t } = useTranslation();

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-10 md:py-24">
      <p className="eyebrow">{t('landing.testimonials.eyebrow')}</p>
      <h2 className="mt-2 max-w-2xl font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-4xl">
        {t('landing.testimonials.title')}
      </h2>

      <div className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
        {TESTIMONIALS.map((item) => (
          <figure key={item.nameKey} className="flex flex-col rounded-lg bg-surface p-6 shadow-md">
            {/* A typographic quote mark rather than an icon — there is no quote
                glyph in the brand's icon set, and inventing one for a single use
                would be exactly the "foreign visual language" Principle VI
                warns against. */}
            <span aria-hidden="true" className="text-sunset font-display text-5xl leading-none">
              &ldquo;
            </span>
            <blockquote className="mt-2 flex-1 text-[15px] leading-relaxed text-text">
              {t(item.quoteKey)}
            </blockquote>
            <figcaption className="mt-5 border-t border-border pt-4">
              <p className="text-sm font-extrabold text-text">{t(item.nameKey)}</p>
              <p className="text-xs text-muted">{t(item.roleKey)}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted">{t('landing.testimonials.disclaimer')}</p>
    </section>
  );
}
