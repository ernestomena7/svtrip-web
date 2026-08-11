// Unit coverage for the subscription entitlement logic that gates provider
// capabilities (US8 / T093). Pure functions — no Firebase, no DOM.
import { describe, it, expect } from 'vitest';
import {
  effectiveEntitlements,
  effectiveTier,
  entitlementsForTier,
  TIER_ENTITLEMENTS,
  type Subscription,
} from '@svtrip/shared';

const active = (tier: 'basic' | 'pro' | 'ultra'): Subscription => ({
  tier,
  entitlements: entitlementsForTier(tier),
  status: 'active',
  selectedAt: 1,
});

describe('subscription entitlements', () => {
  it('defaults to Basic when there is no subscription', () => {
    expect(effectiveTier(null)).toBe('basic');
    expect(effectiveEntitlements(null)).toEqual(TIER_ENTITLEMENTS.basic);
  });

  it('ignores a non-active subscription (falls back to Basic)', () => {
    const none: Subscription = { ...active('ultra'), status: 'none' };
    expect(effectiveTier(none)).toBe('basic');
    expect(effectiveEntitlements(none).analyticsDepth).toBe('basic');
  });

  it('grants rank boost from Pro upward but advanced analytics only on Ultra', () => {
    expect(entitlementsForTier('basic').rankBoost).toBe(false);
    expect(entitlementsForTier('pro').rankBoost).toBe(true);
    expect(entitlementsForTier('pro').analyticsDepth).toBe('basic');
    expect(entitlementsForTier('ultra').analyticsDepth).toBe('advanced');
  });

  it('returns the active tier and its entitlements', () => {
    expect(effectiveTier(active('pro'))).toBe('pro');
    expect(effectiveEntitlements(active('ultra'))).toEqual(TIER_ENTITLEMENTS.ultra);
  });
});
