// Entitlement gating for the signed-in merchant (feature 018).
//
// Returns the plan, the DERIVED state, what that plan unlocks, and which places
// it covers. Three things worth knowing about the shape:
//
//  1. **The state is computed here, not read.** There is no stored `status`
//     (FR-043) — the product has no scheduler, so a stored one would need
//     something to rewrite it and nothing would. `now` is captured per render,
//     which is exactly what makes a campaign expire without anything running.
//  2. **Entitlements are derived from the plan code**, never read from the
//     document. The old model stored a copy on a page the merchant could write,
//     free to disagree with the tier beside it.
//  3. **No subscription grants NOTHING.** The old hook defaulted to the free
//     `basic` tier, which was correct when `basic` was $0 and is wrong now:
//     every plan is paid, so "no plan chosen" is the state US1 scenario 5
//     describes, not a free ride.
import { useEffect, useMemo, useState } from 'react';
import {
  coveredPlaceIds as computeCovered,
  entitlementsForPlan,
  isVisibleState,
  subscriptionState,
  type Entitlements,
  type MerchantSubscription,
  type PlanCode,
  type SubscriptionState,
} from '@svtrip/shared';
import { useAuth } from '../auth/AuthProvider';
import { subscribeToSubscription } from './subscriptionRepo';
import { useManagedBusinesses } from './useManagedBusinesses';

/** What a merchant with no plan can do: nothing this feature gates. */
const NO_ENTITLEMENTS: Entitlements = {
  catalogVisible: false,
  selfService: false,
  ownProfilePromotions: false,
  basicMetrics: false,
  expandedMetrics: false,
  rankBoost: false,
  offersPublishing: false,
};

export interface EntitlementsState {
  /** `null` when this account has not chosen a plan (US1 scenario 5). */
  planCode: PlanCode | null;
  state: SubscriptionState | null;
  entitlements: Entitlements;
  subscription: MerchantSubscription | null;
  /** Places this subscription covers right now. */
  coveredPlaceIds: string[];
  /** Every place this account manages, covered or not. */
  managedPlaceIds: string[];
  /** Whether travelers can currently see the covered places. */
  visible: boolean;
  loading: boolean;
}

export function useEntitlements(): EntitlementsState {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<MerchantSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  // `useManagedBusinesses` signals loading with a null list rather than a flag,
  // so that is read here instead of inventing a second convention.
  const { listings } = useManagedBusinesses();
  const listingsLoading = listings === null;

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    // Kept from the previous version, and the reason has not changed: the
    // effect re-runs on a switch between accounts, and without this reset the
    // new owner reads the previous one's plan until the first snapshot lands.
    // `loading` alone does not cover it, because the plan is returned anyway.
    setSubscription(null);
    setLoading(true);
    return subscribeToSubscription(user.uid, (sub) => {
      setSubscription(sub);
      setLoading(false);
    });
  }, [user]);

  const managedPlaceIds = useMemo(
    () => (listings ?? []).map((l) => l.listingId),
    [listings],
  );

  return useMemo(() => {
    if (!subscription) {
      return {
        planCode: null,
        state: null,
        entitlements: NO_ENTITLEMENTS,
        subscription: null,
        coveredPlaceIds: [],
        managedPlaceIds,
        visible: false,
        loading: loading || listingsLoading,
      };
    }

    // Captured per render on purpose (see note 1 above).
    const state = subscriptionState(subscription, Date.now());
    return {
      planCode: subscription.planCode,
      state,
      entitlements: entitlementsForPlan(subscription.planCode),
      subscription,
      coveredPlaceIds: computeCovered({
        planCode: subscription.planCode,
        state,
        managedPlaceIds,
        coveredPlaceId: subscription.coveredPlaceId,
      }),
      managedPlaceIds,
      visible: isVisibleState(state),
      loading: loading || listingsLoading,
    };
  }, [subscription, managedPlaceIds, loading, listingsLoading]);
}
