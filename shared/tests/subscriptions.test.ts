// The plan and entitlement table (feature 018, FR-001/FR-012/FR-013/FR-035/FR-038).
//
// THIS FILE DID NOT EXIST BEFORE, AND THAT IS THE POINT.
//
// Measured at T001: `shared/tests/` held 15 files and none of them covered
// `subscriptions.ts`. The tier model this feature replaces — `basic`/`pro`/
// `ultra`, its price table, its entitlement map — was NEVER TESTED. So when
// 018 rewrote it, "nothing went red" would have been a statement about a suite
// that never looked, which is the same situation feature 017 found with
// `BottomNav` after 016 measured that the visual gate hides a whole nav tab.
import { describe, it, expect } from 'vitest';
import {
  COMMERCIAL_PLANS,
  PLAN_CODES,
  PLAN_ENTITLEMENTS,
  PLAN_PRICE_USD,
  entitlementsForPlan,
  isCommercialPlan,
  isPlanCode,
  type PlanCode,
} from '../src/subscriptions.js';

describe('exactly two plans are sellable, and a third is not', () => {
  // FR-001. "Exactly two" holds for every merchant-facing surface; the internal
  // plan exists but is never offered, priced or selectable (FR-035c, spec D6).
  it('offers exactly two commercial plans', () => {
    expect(COMMERCIAL_PLANS).toEqual(['basico', 'premium']);
  });

  it('knows three plan codes in total', () => {
    expect(PLAN_CODES).toEqual(['basico', 'premium', 'internal']);
  });

  it('does not count the internal plan as commercial', () => {
    expect(isCommercialPlan('internal')).toBe(false);
    expect(isCommercialPlan('basico')).toBe(true);
    expect(isCommercialPlan('premium')).toBe(true);
  });

  it('rejects the retired tier names', () => {
    // `basic` is one letter from `basico` and meant something different — a
    // FREE tier. A stale value reaching the new model must not resolve.
    for (const retired of ['basic', 'pro', 'ultra', '']) {
      expect(isPlanCode(retired)).toBe(false);
    }
  });
});

describe('prices', () => {
  it('charges $30 for Básico and $50 for Premium', () => {
    expect(PLAN_PRICE_USD.basico).toBe(30);
    expect(PLAN_PRICE_USD.premium).toBe(50);
  });

  it('gives every commercial plan a price above zero — there is no free plan', () => {
    // Decision 1 of the source document, and the thing the replaced model got
    // wrong: `basic` was $0.
    for (const code of COMMERCIAL_PLANS) {
      expect(PLAN_PRICE_USD[code]).toBeGreaterThan(0);
    }
  });

  it('gives the internal plan no price at all', () => {
    expect(PLAN_PRICE_USD.internal).toBe(0);
  });
});

describe('the entitlements matrix, row for row', () => {
  const row = (code: PlanCode) => entitlementsForPlan(code);

  it('gives Básico catalog visibility, self-service, own-profile promotions and basic metrics', () => {
    const e = row('basico');
    expect(e.catalogVisible).toBe(true);
    expect(e.selfService).toBe(true);
    expect(e.ownProfilePromotions).toBe(true);
    expect(e.basicMetrics).toBe(true);
  });

  it('withholds all three Premium capabilities from Básico', () => {
    const e = row('basico');
    expect(e.expandedMetrics).toBe(false);
    expect(e.rankBoost).toBe(false);
    expect(e.offersPublishing).toBe(false);
  });

  it('gives Premium everything in Básico plus the three', () => {
    const basico = row('basico');
    const premium = row('premium');
    // Everything Básico has, Premium has — asserted as a property rather than
    // by re-listing the rows, so adding a Básico capability cannot silently
    // leave Premium behind.
    for (const [key, value] of Object.entries(basico)) {
      if (value === true) {
        expect(premium[key as keyof typeof premium]).toBe(true);
      }
    }
    expect(premium.expandedMetrics).toBe(true);
    expect(premium.rankBoost).toBe(true);
    expect(premium.offersPublishing).toBe(true);
  });
});

describe('the internal plan grants coverage and NOT commercial placement', () => {
  // FR-038, and this is the row that matters most in the whole table.
  //
  // Measured 2026-10-02 (baseline-live.txt): moving the house account to the
  // old `ultra` tier set `boosted: true` on 33 OF 33 LISTINGS, because the old
  // repo denormalized `rankBoost` onto every listing the account owned. It is
  // inert while every entry shares it — a flag everything has orders nothing —
  // but the first merchant to join on Básico would be outranked by the ENTIRE
  // HOUSE CATALOG, inverting what Premium is sold to do.
  it('does not grant rankBoost', () => {
    expect(entitlementsForPlan('internal').rankBoost).toBe(false);
  });

  it('still grants catalog visibility and self-service', () => {
    const e = entitlementsForPlan('internal');
    expect(e.catalogVisible).toBe(true);
    expect(e.selfService).toBe(true);
  });

  it('is the ONLY plan that has metrics without placement', () => {
    // Behavioural statement of the asymmetry, so a future edit that "tidies up"
    // the internal plan by copying Premium's row reddens here.
    const e = entitlementsForPlan('internal');
    expect(e.expandedMetrics).toBe(true);
    expect(e.rankBoost).toBe(false);
    // Premium, by contrast, has both.
    expect(entitlementsForPlan('premium').expandedMetrics).toBe(true);
    expect(entitlementsForPlan('premium').rankBoost).toBe(true);
  });
});

describe('entitlements are derived from the plan, never read from a stored blob', () => {
  // The replaced model stored an `entitlements` copy on an owner-writable
  // document, free to disagree with the tier beside it. Its own comment said
  // so, and said what had to change "the day billing becomes real".
  it('returns the table entry for the code, by identity', () => {
    for (const code of PLAN_CODES) {
      expect(entitlementsForPlan(code)).toBe(PLAN_ENTITLEMENTS[code]);
    }
  });

  it('falls back to Básico for an unrecognised code', () => {
    // Fails toward the LEAST privilege. A stale `ultra` arriving from an
    // un-migrated document must not resolve to something generous.
    expect(entitlementsForPlan('ultra' as PlanCode)).toBe(PLAN_ENTITLEMENTS.basico);
  });
});
