// Subscription data access (feature 018).
//
// WHAT CHANGED, and it is the point of the feature rather than a refactor:
// `selectTier` is GONE. It wrote `providerProfiles/{uid}.subscription` straight
// from the browser and denormalized `boosted` onto every listing the account
// owned — which is how 33 of 33 live listings ended up boosted (measured,
// `specs/018-merchant-subscription-plans/baseline-live.txt`).
//
// Plan changes now go through the BFF (FR-026), and the Firestore rules refuse
// the client write, so there is no second path to keep in step with the first.
// What stays here is the READ, because the merchant's own screens want it live.
import { doc, onSnapshot } from 'firebase/firestore';
import type { LaunchCampaignConfig, MerchantSubscription, SubscriptionPlanConfig } from '@svtrip/shared';
import { db } from '../firebase';
import { fetchPlans } from '../apiClient';

/**
 * Live subscription for one account (null when none).
 *
 * The error callback is kept from the previous version and the reason is worth
 * not re-learning: without it a permission-denied or dropped listener is
 * swallowed by the SDK and the caller waits on a snapshot that will never
 * arrive — the provider dashboard spins forever. Reporting "no subscription" is
 * the honest answer and the safe one, because with no subscription nothing is
 * granted.
 */
export function subscribeToSubscription(
  uid: string,
  cb: (sub: MerchantSubscription | null) => void,
): () => void {
  return onSnapshot(
    doc(db, 'providerProfiles', uid),
    (snap) => {
      cb((snap.data()?.subscription as MerchantSubscription | undefined) ?? null);
    },
    () => cb(null),
  );
}

export interface PlanCatalog {
  plans: SubscriptionPlanConfig[];
  campaign: LaunchCampaignConfig;
}

/**
 * The price list and the campaign.
 *
 * Fetched from the BFF rather than read from Firestore even though the rules
 * allow a signed-in client to read both: the fallback to the compiled defaults
 * lives server-side, and before the team has ever opened the admin screen those
 * documents do not exist. A chooser that renders an empty card because nobody
 * has set a price yet would be a worse first impression than one that renders
 * the shipped default.
 */
export function fetchPlanCatalog(): Promise<PlanCatalog> {
  return fetchPlans();
}

export {
  cancelSubscription,
  changeSubscriptionPlan,
  chooseSubscriptionPlan,
  fetchMySubscription,
} from '../apiClient';
