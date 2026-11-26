// Feature 025 (T041): the promotion and the plans — the business page's only live parts (FR-007, FR-028).
//
// Rendered from GET /api/public/merchant-offer at view time, never from the prerender:
//   - while loading, and in the prerendered HTML: NOTHING about the promotion and no price (fail closed);
//   - window open: the promotion, with the closing date, and the plans note with the free-period clause;
//   - window closed: no promotion and no mention of it anywhere — the plans stay;
//   - request failed: the plans with what they include and NO price — a stale price is a false claim
//     about money (R9).
// Premium's ranking boost is not part of the free period (FR-006a, the product owner's decision), and
// the promotion says so rather than promising it.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';

interface Offer {
  promotion: null | { closesAt: string; closesOnLocal: string; benefitPlan: 'premium'; benefitMonths: number };
  plans: { code: 'basico' | 'premium'; name: { es: string; en: string } | null; monthlyPriceUsd: number; includes: string[] }[];
}

/** The plans as the product knows them without the server: names and contents, never a price. */
const FALLBACK_PLANS: Offer['plans'] = [
  { code: 'basico', name: null, monthlyPriceUsd: NaN, includes: ['catalogVisible', 'selfService', 'ownProfilePromotions', 'basicMetrics'] },
  { code: 'premium', name: null, monthlyPriceUsd: NaN, includes: ['catalogVisible', 'selfService', 'ownProfilePromotions', 'basicMetrics', 'expandedMetrics', 'rankBoost', 'offersPublishing'] },
];

function formatDayMonth(isoDate: string, lang: 'es' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-SV', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function OfferSections({ lang }: { lang: 'es' | 'en' }) {
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [offer, setOffer] = useState<Offer | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/public/merchant-offer`)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Offer;
        if (alive) {
          setOffer(body);
          setState('ready');
        }
      })
      .catch(() => alive && setState('failed'));
    return () => {
      alive = false;
    };
  }, []);

  if (state === 'loading') return null;

  const promotion = state === 'ready' ? offer?.promotion ?? null : null;
  const plans = state === 'ready' && offer ? offer.plans : FALLBACK_PLANS;
  const nameOf = (p: Offer['plans'][number]) => p.name?.[lang]?.trim() || t(`subscription.plans.${p.code}`);

  return (
    <>
      {promotion && (
        <section className="mx-auto max-w-5xl px-5 pt-14 md:px-10 md:pt-20" data-testid="business-promotion">
          <div className="rounded-xl bg-sunset p-6 text-white shadow-lg md:p-8">
            <p className="eyebrow text-white/90">{t('landing.business.promotion.eyebrow')}</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] md:text-3xl">
              {t('landing.business.promotion.title', { months: promotion.benefitMonths })}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-white/90 md:text-base">
              {t('landing.business.promotion.body', { date: formatDayMonth(promotion.closesOnLocal, lang), months: promotion.benefitMonths })}
            </p>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-5xl px-5 pt-14 md:px-10 md:pt-20" data-testid="business-plans">
        <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">{t('landing.business.plans.title')}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <article key={p.code} className="rounded-lg bg-surface p-6 shadow-md" data-testid={`business-plan-${p.code}`}>
              <p className="eyebrow">{nameOf(p)}</p>
              {Number.isFinite(p.monthlyPriceUsd) && (
                <p className="mt-2 font-display text-3xl font-extrabold text-text" data-testid="business-plan-price">
                  {t('landing.business.plans.price', { price: p.monthlyPriceUsd })}
                </p>
              )}
              <ul className="mt-4 space-y-1.5">
                {p.includes.map((key) => (
                  <li key={key} className="text-sm text-muted">
                    {t(`landing.business.plans.includes.${key}`)}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted" data-testid="business-plans-note">
          {promotion ? t('landing.business.plans.noteWithPromotion') : t('landing.business.plans.note')}
        </p>
      </section>
    </>
  );
}
