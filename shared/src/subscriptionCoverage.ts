// Which places a subscription covers (feature 018, FR-050/FR-051/FR-035a).
//
// THIS IS WHERE BÁSICO'S ONE-PLACE CAP ACTUALLY LIVES, and the reason is
// measured rather than preferred: FIRESTORE RULES CANNOT COUNT.
//
// There is no aggregation in security rules, so "this account already manages a
// listing" is not expressible there. The nearest thing is a `get()` against a
// stored counter, which reintroduces exactly the stored-derived-value trap
// FR-043 rejects — and costs a document read on every create.
//
// So a second place on Básico is not REFUSED at creation. It is simply not
// COVERED, and FR-016's visibility derivation does the rest: an uncovered place
// is not visible. The UI refuses it and offers Premium (US4 scenario 1a), and a
// client that bypasses the UI gains an invisible listing, which is not an
// exploit.
//
// Pure, so the BFF runs it when recomputing the denormalized `covered` flag.
import { isVisibleState, type PlanCode, type SubscriptionState } from './subscriptionState.js';

/** What a coverage decision depends on. */
export interface CoverageInput {
  planCode: PlanCode;
  /** The DERIVED state (FR-043), never a stored one. */
  state: SubscriptionState;
  /** Every place this account currently manages. */
  managedPlaceIds: readonly string[];
  /**
   * Básico only: the single place it covers (FR-050).
   *
   * Absent on a Básico subscription means the merchant has not chosen yet, and
   * the answer is "covers nothing" rather than "covers the first one" —
   * choosing for the merchant is what US4 scenario 1b forbids.
   */
  coveredPlaceId?: string;
}

/** Plans whose single price covers every place the account manages. */
const UNLIMITED_PLANS: ReadonlySet<PlanCode> = new Set<PlanCode>(['premium', 'internal']);

/**
 * Every place this subscription covers right now.
 *
 * Returns a subset of `managedPlaceIds` and never invents an id, which matters
 * for the handover case: the subscription belongs to the ACCOUNT and does not
 * travel with a place (spec Edge Cases), so a `coveredPlaceId` left pointing at
 * a place that has been handed away must stop granting coverage rather than
 * keep naming it.
 */
export function coveredPlaceIds(sub: CoverageInput): string[] {
  // Suspension is the whole point of the state machine: the places stop being
  // visible. If coverage survived it, nothing downstream would hide anything.
  if (!isVisibleState(sub.state)) return [];

  if (UNLIMITED_PLANS.has(sub.planCode)) return [...sub.managedPlaceIds];

  // Básico: exactly one, and only if the account still manages it.
  if (sub.coveredPlaceId === undefined) return [];
  return sub.managedPlaceIds.includes(sub.coveredPlaceId) ? [sub.coveredPlaceId] : [];
}

/** Whether this subscription covers one particular place. */
export function coversPlace(sub: CoverageInput, placeId: string): boolean {
  if (!isVisibleState(sub.state)) return false;
  if (!sub.managedPlaceIds.includes(placeId)) return false;
  if (UNLIMITED_PLANS.has(sub.planCode)) return true;
  return sub.coveredPlaceId === placeId;
}

/**
 * How many places this plan may cover, or `null` for no limit.
 *
 * Exposed so the UI can say *why* a second place needs Premium rather than
 * refusing without a reason (FR-050), and so the BFF's 409 and the screen's
 * prompt read from one number instead of two copies of it.
 */
export function placeLimitFor(planCode: PlanCode): number | null {
  return planCode === 'basico' ? 1 : null;
}

/**
 * Whether this account may take on one more place under its current plan.
 *
 * `false` means "Premium required", not "refused" — the distinction the upgrade
 * prompt depends on.
 */
export function canManageAnotherPlace(planCode: PlanCode, managedCount: number): boolean {
  const limit = placeLimitFor(planCode);
  return limit === null || managedCount < limit;
}
