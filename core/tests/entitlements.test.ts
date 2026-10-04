// RETIRED by feature 018, and kept as a marker rather than deleted silently.
//
// This file used to hold four cases over the `basic`/`pro`/`ultra` tier model:
// `effectiveTier`, `effectiveEntitlements`, `entitlementsForTier` and
// `TIER_ENTITLEMENTS`. Feature 018 replaced that model with two paid plans plus
// a hidden internal one, so none of those functions exists any more and the
// cases could not be "updated" — the behaviour they described is the behaviour
// the feature removed.
//
// **An edited test is evidence of a behaviour change**, which is this
// repository's standing rule. Here the behaviour change IS the feature, so
// retiring these is correct — and saying so in the file is what keeps that
// honest, because a deleted file leaves no trace of what used to be asserted.
//
// WHERE THE COVERAGE WENT, and it is broader than what was here:
//
//   shared/tests/subscriptions.test.ts         the plan table and the
//                                              entitlements matrix, row for row
//                                              — INCLUDING the prices, which the
//                                              retired cases never asserted
//   shared/tests/subscriptionState.test.ts     the derived state (19 cases)
//   shared/tests/subscriptionCoverage.test.ts  which places a plan covers
//   firestore/tests/subscriptions.rules.test.ts the privilege boundary that
//                                              did not exist before
//
// One correction belongs here too, because this file is what disproved it:
// research.md R1 recorded that the replaced model had ZERO tests. It had these
// four. The search that produced "zero" looked in `core/src/**/*.test.*` and
// this file is in `core/tests/`. R1 is corrected in place.
import { describe, it, expect } from 'vitest';
import { PLAN_PRICE_USD, entitlementsForPlan } from '@svtrip/shared';

describe('the retired tier model', () => {
  it('is gone, and the free tier with it', () => {
    // The one assertion worth keeping at this layer: there is no $0 plan any
    // more. Decision 1 of the source document, and the thing the old `basic`
    // tier got wrong.
    for (const code of ['basico', 'premium'] as const) {
      expect(PLAN_PRICE_USD[code]).toBeGreaterThan(0);
    }
  });

  it('left no plan that grants placement for free', () => {
    // FR-038. The internal plan is the only free one and it must not boost —
    // the house holds 33 of 33 catalog entries.
    expect(entitlementsForPlan('internal').rankBoost).toBe(false);
  });
});
