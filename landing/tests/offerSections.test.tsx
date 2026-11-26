// Feature 025 (T039): the live parts of the business page. The PRERENDERED HTML's fail-closed state is
// asserted on the build (businessPage.test.ts); this file asserts what the page does once it asks.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import i18n from '@svtrip/core/i18n';
import { PLAN_ENTITLEMENTS } from '@svtrip/shared';
import { OfferSections } from '../src/business/OfferSections';

const PLANS = [
  { code: 'basico', name: { es: 'Standard', en: 'Standard' }, monthlyPriceUsd: 30, includes: ['catalogVisible', 'selfService', 'ownProfilePromotions', 'basicMetrics'] },
  { code: 'premium', name: null, monthlyPriceUsd: 50, includes: ['catalogVisible', 'selfService', 'ownProfilePromotions', 'basicMetrics', 'expandedMetrics', 'rankBoost', 'offersPublishing'] },
];
const OPEN = { closesAt: '2027-02-01T06:00:00.000Z', closesOnLocal: '2027-01-31', benefitPlan: 'premium', benefitMonths: 3 };

function respond(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, json: async () => body })));
}

beforeEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('es');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OfferSections', () => {
  it('window open: the promotion with day and month, the free-period note, and the stored plan name', async () => {
    respond(200, { promotion: OPEN, plans: PLANS });
    render(<OfferSections lang="es" />);
    const promo = await screen.findByTestId('business-promotion');
    expect(promo.textContent).toMatch(/31 de enero/);
    expect(promo.textContent).toMatch(/3 meses/);
    expect(screen.getByTestId('business-plans-note').textContent).toMatch(/cuántos días te quedan/);
    expect(screen.getByTestId('business-plan-basico').textContent).toMatch(/Standard/);
    expect(screen.getByTestId('business-plan-basico').textContent).toMatch(/\$30/);
  });

  it('the promotion says the ranking boost starts once paid (FR-006a)', async () => {
    respond(200, { promotion: OPEN, plans: PLANS });
    render(<OfferSections lang="es" />);
    expect((await screen.findByTestId('business-promotion')).textContent).toMatch(/destacado/i);
  });

  it('window closed: no promotion and no mention of a free period — the plans and prices stay (FR-007)', async () => {
    respond(200, { promotion: null, plans: PLANS });
    const { container } = render(<OfferSections lang="es" />);
    await screen.findByTestId('business-plans');
    expect(screen.queryByTestId('business-promotion')).toBeNull();
    expect(container.textContent).not.toMatch(/gratis|per[ií]odo gratis/i);
    expect(screen.getAllByTestId('business-plan-price')).toHaveLength(2);
  });

  it('request failed: the plans WITHOUT prices, never a stale price (R9)', async () => {
    respond(503, { code: 'unavailable' });
    render(<OfferSections lang="es" />);
    await screen.findByTestId('business-plans');
    expect(screen.queryByTestId('business-plan-price')).toBeNull();
    expect(screen.queryByTestId('business-promotion')).toBeNull();
  });

  it('every include the page can show is a real entitlement, and the AI guide is never named (FR-003)', async () => {
    respond(503, {});
    const { container } = render(<OfferSections lang="es" />);
    await screen.findByTestId('business-plans');
    const known = new Set(Object.keys(PLAN_ENTITLEMENTS.premium));
    for (const p of PLANS) for (const k of p.includes) expect(known.has(k), k).toBe(true);
    expect(container.textContent).not.toMatch(/gu[ií]a|guide|\bIA\b|\bAI\b/i);
  });

  it('English', async () => {
    await i18n.changeLanguage('en');
    respond(200, { promotion: OPEN, plans: PLANS });
    render(<OfferSections lang="en" />);
    expect((await screen.findByTestId('business-promotion')).textContent).toMatch(/January 31/);
  });
});
