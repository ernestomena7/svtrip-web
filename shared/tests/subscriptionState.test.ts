// The derived subscription state (feature 018, FR-043).
//
// WHY THESE ASSERT BEHAVIOUR AND NOT SHAPE.
//
// Feature 017 wrote a row asserting `visibleMoods.length === 3` to mean "saved
// moods have no way in". The sabotage that did exactly the forbidden thing —
// adding a fourth parameter WITH A DEFAULT and reordering by it — left all
// eleven cases green, because JavaScript counts parameters only up to the first
// with a default. The test reported a pass about a function doing the thing it
// forbade.
//
// So every case here asserts what `subscriptionState` RETURNS for a given set
// of facts and a given `now`. There is no assertion about the function's arity,
// the object's keys, or anything that merely correlates with correctness.
//
// `now` is a parameter, which is what lets these walk 90 days in a millisecond.
import { describe, it, expect } from 'vitest';
import {
  subscriptionState,
  GRACE_DAYS,
  type SubscriptionFacts,
} from '../src/subscriptionState.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 2); // 2026-10-02, the day the feature was specified

/** A subscription with nothing set — the shape every case starts from. */
function facts(over: Partial<SubscriptionFacts> = {}): SubscriptionFacts {
  return { planCode: 'basico', paymentActive: false, ...over };
}

describe('the internal plan is unreachable by any date', () => {
  // Cases 1 and 2. This is FIRST in the resolution order on purpose: the house
  // account holds 33 of 33 catalog entries (see baseline-live.txt), so a date
  // that could suspend it is the whole catalog going dark, taking the AI Guide
  // — which fails closed — with it.
  it('is active with every date in the past', () => {
    expect(
      subscriptionState(
        facts({
          planCode: 'internal',
          campaignEndsAt: NOW - 400 * DAY,
          currentPeriodEndsAt: NOW - 300 * DAY,
        }),
        NOW,
      ),
    ).toBe('active');
  });

  it('is active even with grace long expired and no payment', () => {
    expect(
      subscriptionState(
        facts({ planCode: 'internal', graceEndsAt: NOW - 100 * DAY, paymentActive: false }),
        NOW,
      ),
    ).toBe('active');
  });

  it('is active even when cancelled with the period over', () => {
    // Not in the contract's table, added because FR-035b says the internal plan
    // never enters `cancelled` either, and the cancel branch sits above grace.
    expect(
      subscriptionState(
        facts({
          planCode: 'internal',
          cancelledAt: NOW - 50 * DAY,
          currentPeriodEndsAt: NOW - 10 * DAY,
        }),
        NOW,
      ),
    ).toBe('active');
  });
});

describe('the campaign', () => {
  it('is in campaign on day 1', () => {
    expect(subscriptionState(facts({ campaignEndsAt: NOW + 89 * DAY }), NOW)).toBe('campaign');
  });

  it('is in campaign on day 89', () => {
    expect(subscriptionState(facts({ campaignEndsAt: NOW + 1 * DAY }), NOW)).toBe('campaign');
  });

  it('falls to grace on day 90 when unpaid', () => {
    expect(subscriptionState(facts({ campaignEndsAt: NOW, paymentActive: false }), NOW)).toBe(
      'grace',
    );
  });

  it('becomes active on day 90 when paid', () => {
    expect(subscriptionState(facts({ campaignEndsAt: NOW, paymentActive: true }), NOW)).toBe(
      'active',
    );
  });
});

describe('grace is VISIBLE and suspension is not', () => {
  // Cases 6 and 7. Swapping these turns a 7-day cushion into a 7-day outage,
  // which is the difference between the source document's mitigation and the
  // risk it was written to mitigate.
  it('is still in grace on the last day of it', () => {
    expect(subscriptionState(facts({ graceEndsAt: NOW + 1 }), NOW)).toBe('grace');
  });

  it('is suspended once grace runs out', () => {
    expect(subscriptionState(facts({ graceEndsAt: NOW }), NOW)).toBe('suspended');
  });

  it('gives exactly GRACE_DAYS after an unpaid campaign, not more', () => {
    const campaignEnd = NOW - GRACE_DAYS * DAY;
    // One millisecond before the grace derived from the campaign expires.
    expect(subscriptionState(facts({ campaignEndsAt: campaignEnd }), NOW - 1)).toBe('grace');
    // And at it.
    expect(subscriptionState(facts({ campaignEndsAt: campaignEnd }), NOW)).toBe('suspended');
  });
});

describe('cancellation runs out the period, never immediately', () => {
  it('is cancelled while the paid period still has time', () => {
    expect(
      subscriptionState(
        facts({ cancelledAt: NOW - DAY, currentPeriodEndsAt: NOW + 10 * DAY, paymentActive: true }),
        NOW,
      ),
    ).toBe('cancelled');
  });

  it('is suspended once the paid period is over', () => {
    expect(
      subscriptionState(
        facts({ cancelledAt: NOW - 30 * DAY, currentPeriodEndsAt: NOW, paymentActive: true }),
        NOW,
      ),
    ).toBe('suspended');
  });
});

describe('a plan chosen after the window grants nothing', () => {
  // Cases 10 and 11. Falling through to `active` here hands the plan over free
  // to every merchant who enrolls after the enrollment window closes.
  it('is pending_payment with no campaign and no payment', () => {
    expect(subscriptionState(facts({ paymentActive: false }), NOW)).toBe('pending_payment');
  });

  it('is active once a payment exists', () => {
    expect(subscriptionState(facts({ paymentActive: true }), NOW)).toBe('active');
  });

  it('does not treat pending_payment as a paying state', () => {
    // Asserted as behaviour rather than by inspecting a list of "granting"
    // states: what matters is that the function does not say `active`.
    const state = subscriptionState(facts({ paymentActive: false }), NOW);
    expect(state).not.toBe('active');
    expect(state).not.toBe('campaign');
  });
});

describe('premium and basico resolve identically — the plan does not change the state machine', () => {
  // Nothing in the spec gives Premium a different lifecycle; only different
  // entitlements. A divergence here would be a defect, so it is pinned.
  it.each(['basico', 'premium'] as const)('%s in an unpaid expired campaign is grace', (planCode) => {
    expect(subscriptionState(facts({ planCode, campaignEndsAt: NOW }), NOW)).toBe('grace');
  });

  it.each(['basico', 'premium'] as const)('%s with an expired grace is suspended', (planCode) => {
    expect(subscriptionState(facts({ planCode, graceEndsAt: NOW }), NOW)).toBe('suspended');
  });
});
