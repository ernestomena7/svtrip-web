// Feature 025: svtrip.com/negocios (EN /en/business) — the page an invited merchant lands on.
//
// Prerendered like the landing (feature 007): the message is real HTML and survives the backend being
// down. The form is NOT here: it runs in the web app, where the account controls, the map and the
// merchant's session live (research R1). The CTA carries the link origin and the language there.
//
// FAIL CLOSED (FR-007): the prerendered HTML contains no promotion and no price. Both arrive from the
// server at view time (US3), so a page served after the window closes can never still promise it.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { normaliseOrigin } from '@svtrip/shared';
import { ButtonLink } from '../components/Button';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { API_BASE_URL, APP_URL, BUSINESS_CONTACT_EMAIL } from '../config';
import { OfferSections } from './OfferSections';

const WORDMARK = '/svtrip-wordmark.png';
const BENEFITS = ['reach', 'control', 'promotions', 'metrics', 'contact', 'directions'] as const;

/** The form's address in the web app, for a language and an origin (contracts/pages.md). */
export function signupUrl(lang: 'es' | 'en', origin: string | null): string {
  const path = lang === 'en' ? '/en/business/register' : '/negocios/registro';
  const q = new URLSearchParams();
  if (origin) q.set('src', origin);
  q.set('lang', lang);
  return `${APP_URL}${path}?${q.toString()}`;
}

/** The visitor's link origin, read at RUNTIME — the prerendered HTML cannot know it (U9). */
function visitorOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('src') ?? params.get('utm_source');
  return raw === null ? null : normaliseOrigin(raw);
}

export function BusinessPage() {
  const { t, i18n } = useTranslation();
  // From i18n, NOT the UI store: during the prerender zustand serves its INITIAL state ('es') to
  // `renderToString`, so the English document got the Spanish form link. i18n is what the prerender
  // sets per document, and the language switch keeps it in step on the client.
  const lang: 'es' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'es';
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    const found = visitorOrigin();
    setOrigin(found);
    // Once per session, in the browser only — never during the prerender (effects do not run there).
    // A count of an origin and a step; no identifier, and it never throws (feature 025, US4).
    try {
      if (sessionStorage.getItem('svtrip-business-opened')) return;
      sessionStorage.setItem('svtrip-business-opened', '1');
      void fetch(`${API_BASE_URL}/public/signup-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'page_opened', ...(found ? { origin: found } : {}) }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      /* storage or fetch unavailable: stay silent */
    }
  }, []);
  const cta = signupUrl(lang, origin);

  return (
    <div id="top" className="min-h-[100dvh] bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3 md:px-10">
          <a href={lang === 'en' ? '/en.html' : '/'} className="flex items-center">
            <img src={WORDMARK} alt="SVTrip" width={323} height={160} className="h-9 w-auto" />
          </a>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <LanguageSwitch />
          </div>
        </div>
      </header>

      <main>
        {/* 1 — what SVTrip does for a business, and the one action */}
        <section className="bg-dusk">
          <div className="mx-auto max-w-5xl px-5 py-14 md:px-10 md:py-20">
            <p className="eyebrow text-accent" data-testid="business-enrolling">
              {t('landing.business.hero.eyebrow')}
            </p>
            <h1 className="mt-3 max-w-3xl font-display text-3xl font-extrabold tracking-[-0.02em] text-white md:text-5xl">
              {t('landing.business.hero.title')}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/80 md:text-lg">{t('landing.business.hero.body')}</p>
            <div className="mt-8">
              <ButtonLink href={cta} size="lg" data-testid="business-cta">
                {t('landing.business.cta')}
              </ButtonLink>
            </div>
          </div>
        </section>

        {/* 2 — the enrolment phase; the app is coming, with NO date */}
        <section className="mx-auto max-w-5xl px-5 pt-14 md:px-10 md:pt-20">
          <p className="eyebrow">{t('landing.business.about.eyebrow')}</p>
          <h2 className="mt-2 font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">{t('landing.business.about.title')}</h2>
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-muted md:text-base">{t('landing.business.about.body')}</p>
        </section>

        {/* 3 — the benefits, each one something the product does today (FR-003) */}
        <section className="mx-auto max-w-5xl px-5 pt-14 md:px-10 md:pt-20">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">{t('landing.business.benefits.title')}</h2>
          <ul className="mt-6 grid gap-4 md:grid-cols-2">
            {BENEFITS.map((key) => (
              <li key={key} className="rounded-lg bg-surface p-5 shadow-md" data-testid="business-benefit">
                <p className="font-display font-extrabold text-text">{t(`landing.business.benefits.${key}.title`)}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{t(`landing.business.benefits.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 4–5 — the promotion (only while open) and the plans: live from the server (US3) */}
        <OfferSections lang={lang} />

        {/* 6 — a person to ask */}
        <section className="mx-auto max-w-5xl px-5 py-14 md:px-10 md:py-20">
          <div className="rounded-xl bg-surface p-6 shadow-md md:p-8">
            <h2 className="font-display text-xl font-extrabold text-text md:text-2xl">{t('landing.business.contact.title')}</h2>
            <p className="mt-2 text-[15px] text-muted">{t('landing.business.contact.body')}</p>
            <a href={`mailto:${BUSINESS_CONTACT_EMAIL}`} className="mt-4 inline-block font-bold text-primary underline underline-offset-4" data-testid="business-contact">
              {BUSINESS_CONTACT_EMAIL}
            </a>
            <div className="mt-6">
              <ButtonLink href={cta} size="lg">
                {t('landing.business.cta')}
              </ButtonLink>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
