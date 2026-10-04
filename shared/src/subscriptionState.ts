// The subscription state (feature 018, FR-043/FR-044).
//
// THE STATE IS DERIVED, NEVER STORED — and that is not a style preference.
//
// Measured while planning this feature: SVTrip has no scheduler, no cron and no
// background job of any kind. Six states move with the passage of time (a
// campaign expiring, grace running out, a cancelled period ending), so a stored
// `status` would need something to rewrite it, and there is nothing to do that.
//
// The rule this follows is the one `publication.ts` already states for
// publication readiness: "a stored status has to be rewritten on every content
// change to stay truthful, and a missed write silently publishes an incomplete
// profile". Here the failure is worse in BOTH directions — a job that did not
// run leaves a suspended place VISIBLE, or a paying merchant HIDDEN, and in
// neither case does anything report that the answer is stale.
//
// Derived, there is no stale.
//
// Pure, so the BFF can run it: no React, no DOM, no I/O, and no clock of its
// own — `now` is a parameter, exactly as in `tripOrder` and `promotion.ts`,
// which is what lets a test walk 90 days in a millisecond.

/** The two plans a merchant can buy, plus the team's own (FR-001, FR-035). */
export type PlanCode = 'basico' | 'premium' | 'internal';

export type SubscriptionState =
  | 'campaign'
  | 'active'
  | 'grace'
  | 'suspended'
  | 'cancelled'
  | 'pending_payment';

/**
 * What the derivation reads. These are FACTS, written when something happens;
 * the state is the conclusion drawn from them.
 */
export interface SubscriptionFacts {
  planCode: PlanCode;
  /** Whether a payment is currently in force. Set by the team today (FR-021). */
  paymentActive: boolean;
  /** End of the 90-day launch discount, when one applies (FR-005). */
  campaignEndsAt?: number;
  /** End of the 7-day cushion, when one has started (FR-008). */
  graceEndsAt?: number;
  /** End of the period already paid for (FR-019). */
  currentPeriodEndsAt?: number;
  /** Presence means cancellation was requested — not that it took effect. */
  cancelledAt?: number;
}

/** The cushion after a campaign ends unpaid, or a charge fails (FR-008). */
export const GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** States in which travelers may see the places this subscription covers. */
const VISIBLE_STATES: ReadonlySet<SubscriptionState> = new Set<SubscriptionState>([
  'campaign',
  'active',
  'grace',
  'cancelled',
]);

/**
 * The state, derived.
 *
 * **The order of these branches IS the contract** (contracts/subscription-state.md),
 * and two of them are load-bearing in a way that is invisible from the outside:
 *
 * 1. The internal plan is checked FIRST, so no date can reach it. The house
 *    account holds 33 of 33 catalog entries, so an internal subscription that
 *    could be suspended is the whole catalog going dark — and the AI Guide
 *    fails closed behind it.
 * 2. `grace` resolves before `suspended` only because its own expiry is checked
 *    first. Swap them and a 7-day cushion becomes a 7-day outage.
 */
export function subscriptionState(facts: SubscriptionFacts, now: number): SubscriptionState {
  // 1. The team's own plan. No campaign, no expiry, nothing to charge (FR-035b).
  if (facts.planCode === 'internal') return 'active';

  // 2-3. Cancellation runs out the period already covered, never immediately.
  if (facts.cancelledAt !== undefined) {
    if (facts.currentPeriodEndsAt !== undefined && now >= facts.currentPeriodEndsAt) {
      return 'suspended';
    }
    return 'cancelled';
  }

  // 4-5. An explicit grace window, written when a charge failed.
  if (facts.graceEndsAt !== undefined) {
    return now >= facts.graceEndsAt ? 'suspended' : 'grace';
  }

  // 6-7. The campaign, and the grace that follows it WITHOUT anything being
  // written. This is the branch that makes the whole feature work with no
  // scheduler: nothing has to notice the ninetieth day.
  if (facts.campaignEndsAt !== undefined) {
    if (now < facts.campaignEndsAt) return 'campaign';
    if (!facts.paymentActive) {
      return now < facts.campaignEndsAt + GRACE_DAYS * DAY_MS ? 'grace' : 'suspended';
    }
  }

  // 8. Paying.
  if (facts.paymentActive) return 'active';

  // 9. A plan chosen with no campaign and no payment — after the enrollment
  // window closed, or before the team activated anything. Grants NOTHING
  // (US1 scenario 4). Falling through to `active` here would hand the plan
  // over free to every merchant who enrolls late.
  return 'pending_payment';
}

/** Whether travelers may see the places this subscription covers. */
export function isVisibleState(state: SubscriptionState): boolean {
  return VISIBLE_STATES.has(state);
}

/**
 * Days until the campaign ends, or `null` when no campaign applies.
 *
 * Rounded UP, so "1 day left" is true for the whole of the final day rather
 * than becoming "0 days left" at the first second past the boundary.
 */
export function daysRemaining(facts: SubscriptionFacts, now: number): number | null {
  if (facts.campaignEndsAt === undefined) return null;
  const remaining = facts.campaignEndsAt - now;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

/** The notice thresholds the merchant is warned at (FR-007). */
export const NOTICE_THRESHOLDS = [30, 15, 5, 1] as const;

export type NoticeThreshold = (typeof NOTICE_THRESHOLDS)[number];

/**
 * Which warning to show, or nothing.
 *
 * Returns the threshold the remaining time has reached — so 20 days out shows
 * the 15-day warning rather than nothing, which is what makes this a STATE of
 * the screen and not an event. An event-based notice can be missed or sent
 * twice; this one cannot be either.
 *
 * It also cannot reach a merchant who does not open the app, which FR-045
 * records as a known limitation of FR-007 rather than a thing to discover
 * later: the product has no email or push channel, and this feature does not
 * build one.
 */
export function noticeThreshold(days: number | null): NoticeThreshold | null {
  if (days === null || days <= 0) return null;
  // The SMALLEST threshold the remaining days have fallen to or below:
  // 20 days out reaches the 30-day warning, 4 days out reaches the 5-day one.
  // `NOTICE_THRESHOLDS` is ordered largest-first, so this reads it backwards.
  const reached = [...NOTICE_THRESHOLDS].reverse().find((t) => days <= t);
  return reached ?? null;
}
