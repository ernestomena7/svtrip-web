// Subscription tiers and entitlement mapping (US8, FR-027/FR-028).

export type SubscriptionTier = 'basic' | 'pro' | 'ultra';

export interface Entitlements {
  rankBoost: boolean;
  ads: boolean;
  analyticsDepth: 'basic' | 'advanced';
}

export interface Subscription {
  tier: SubscriptionTier;
  entitlements: Entitlements;
  status: 'active' | 'none';
  selectedAt: number;
}

export const TIER_ENTITLEMENTS: Record<SubscriptionTier, Entitlements> = {
  basic: { rankBoost: false, ads: false, analyticsDepth: 'basic' },
  pro: { rankBoost: true, ads: true, analyticsDepth: 'basic' },
  ultra: { rankBoost: true, ads: true, analyticsDepth: 'advanced' },
};

/** Display order, lowest → highest tier. */
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = ['basic', 'pro', 'ultra'];

/** Monthly price in USD (billing is simulated for v1, FR-028). */
export const TIER_PRICE_USD: Record<SubscriptionTier, number> = {
  basic: 0,
  pro: 9.99,
  ultra: 24.99,
};

export function entitlementsForTier(tier: SubscriptionTier): Entitlements {
  return TIER_ENTITLEMENTS[tier];
}

/** Entitlements in effect when a provider has no active subscription (defaults to Basic). */
export function effectiveEntitlements(sub?: Subscription | null): Entitlements {
  if (sub && sub.status === 'active') return sub.entitlements;
  return TIER_ENTITLEMENTS.basic;
}

/** The active tier, or 'basic' when none is selected. */
export function effectiveTier(sub?: Subscription | null): SubscriptionTier {
  return sub && sub.status === 'active' ? sub.tier : 'basic';
}
