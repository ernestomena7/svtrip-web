// Merchant plans and what each one unlocks (feature 018).
//
// THIS FILE REPLACES A LIVE MODEL. Until feature 018 it held three tiers —
// `basic` / `pro` / `ultra` at $0 / $9.99 / $24.99 — keyed to the account,
// writable by the merchant themselves, and covered by NO TESTS AT ALL
// (measured at T001: `shared/tests/` had 15 files and none of them was
// `subscriptions.test.ts`). `shared/tests/subscriptions.test.ts` now exists,
// because "we rewrote the plan model and the suite stayed green" would
// otherwise have been a statement about a suite that never looked.
//
// Two things the old file got right and this one keeps, both load-bearing:
//
// 1. **Entitlements are DERIVED from the plan code, never read from a stored
//    blob.** The old model stored an `entitlements` copy on a document its
//    owner could write, free to disagree with the tier beside it. Its comment
//    said so, and said what had to change "the day billing becomes real".
//    This is that day: `entitlementsForPlan` is a lookup, and nothing persists
//    an entitlement set.
// 2. **An unrecognised code fails toward the LEAST privilege.** A stale
//    `ultra` arriving from an un-migrated document must not resolve to
//    something generous.
import type { PlanCode } from './subscriptionState.js';

export type { PlanCode } from './subscriptionState.js';

/** Every plan code the product knows. `internal` is never sellable (FR-035c). */
export const PLAN_CODES = ['basico', 'premium', 'internal'] as const;

/**
 * The plans a merchant can actually choose, in display order.
 *
 * "Exactly two" (FR-001) is a statement about every merchant-facing surface,
 * which is what this constant is for. The internal plan exists — the team's own
 * account holds it, covering the 33 curated catalog entries — and is argued as
 * a deliberate deviation in spec D6 rather than slipped in.
 */
export const COMMERCIAL_PLANS = ['basico', 'premium'] as const;

export type CommercialPlanCode = (typeof COMMERCIAL_PLANS)[number];

/** What a plan unlocks. Every field is a row of the spec's entitlements matrix. */
export interface Entitlements {
  /** The place appears in the catalog at all. */
  catalogVisible: boolean;
  /** Feature 006's complete self-service. */
  selfService: boolean;
  /** Promotions on the place's own profile. */
  ownProfilePromotions: boolean;
  /** Profile views and contacts (FR-012). */
  basicMetrics: boolean;
  /** Origin of visits, the category benchmark, per-promotion performance (FR-013). */
  expandedMetrics: boolean;
  /** Ranks ahead of unboosted places in listings and search. COMMERCIAL PLACEMENT. */
  rankBoost: boolean;
  /** May publish a promotion to the Ofertas surface. */
  offersPublishing: boolean;
}

/**
 * The matrix.
 *
 * **Read the `internal` row twice.** It grants catalog visibility, self-service
 * and metrics — everything the house's curated entries need — and it does NOT
 * grant `rankBoost`, which is FR-038.
 *
 * Measured 2026-10-02 (`baseline-live.txt`): moving the house account to the
 * old `ultra` tier set `boosted: true` on **33 of 33 listings**, because the
 * old repo denormalized `rankBoost` onto every listing an account owned. That
 * is inert while every entry shares it — a flag everything has orders nothing —
 * but the first merchant to join on Básico would be outranked by the ENTIRE
 * HOUSE CATALOG, which is the exact inverse of what Premium is sold to do.
 *
 * Placement is something a merchant pays for, not something the house inherits
 * from a plan that costs nothing.
 */
export const PLAN_ENTITLEMENTS: Record<PlanCode, Entitlements> = {
  basico: {
    catalogVisible: true,
    selfService: true,
    ownProfilePromotions: true,
    basicMetrics: true,
    expandedMetrics: false,
    rankBoost: false,
    offersPublishing: false,
  },
  premium: {
    catalogVisible: true,
    selfService: true,
    ownProfilePromotions: true,
    basicMetrics: true,
    expandedMetrics: true,
    rankBoost: true,
    offersPublishing: true,
  },
  internal: {
    catalogVisible: true,
    selfService: true,
    ownProfilePromotions: true,
    basicMetrics: true,
    expandedMetrics: true,
    // FR-038. The one row that differs from Premium, and the reason is above.
    rankBoost: false,
    offersPublishing: true,
  },
};

/**
 * Full monthly price in USD.
 *
 * These are the DEFAULTS. FR-001 requires prices to change without a release,
 * so the live figures are read from `subscriptionPlans/{code}` and these are
 * what the product falls back to when that document has not been written yet.
 *
 * `internal` carries no price because it is never charged (FR-035c), and that
 * zero is not a free tier: the source document's Decision 1 is that no free
 * plan exists, and the old model's $0 `basic` is exactly what this replaces.
 */
export const PLAN_PRICE_USD: Record<PlanCode, number> = {
  basico: 30,
  premium: 50,
  internal: 0,
};

/**
 * Launch-campaign discount per plan, as a percentage (FR-005).
 *
 * Básico is free for the 90 days; Premium gets a launch price and therefore
 * **charges from day 1**, which is the product owner's Decision 2 and the
 * reason the gateway sits on the launch's critical path.
 */
export const LAUNCH_DISCOUNT_PERCENT: Record<CommercialPlanCode, number> = {
  basico: 100,
  premium: 50,
};

/** Whether a value is a plan code this product recognises. */
export function isPlanCode(value: unknown): value is PlanCode {
  return typeof value === 'string' && (PLAN_CODES as readonly string[]).includes(value);
}

/** Whether this plan is one a merchant can choose and be charged for. */
export function isCommercialPlan(code: PlanCode): code is CommercialPlanCode {
  return (COMMERCIAL_PLANS as readonly string[]).includes(code);
}

/**
 * What this plan unlocks.
 *
 * Falls back to Básico — the least privileged plan — for anything
 * unrecognised, so a stale `ultra` from an un-migrated document resolves to the
 * smallest grant rather than the largest.
 */
export function entitlementsForPlan(code: PlanCode): Entitlements {
  return PLAN_ENTITLEMENTS[code] ?? PLAN_ENTITLEMENTS.basico;
}

/** The price in effect, given whether the launch discount still applies. */
export function priceInEffect(
  code: PlanCode,
  fullPriceUsd: number,
  discounted: boolean,
): number {
  if (!discounted || !isCommercialPlan(code)) return fullPriceUsd;
  const percent = LAUNCH_DISCOUNT_PERCENT[code];
  // Rounded to cents, so a 50% discount on an odd price does not produce a
  // third decimal that a currency formatter would silently hide.
  return Math.round(fullPriceUsd * (1 - percent / 100) * 100) / 100;
}
