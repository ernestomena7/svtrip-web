// Entitlement gating hook (T093, FR-028). Subscribes to the signed-in
// provider's subscription and exposes the entitlements currently in effect
// (defaulting to Basic when none). Consumers use this to lock/upsell gated
// capabilities such as advanced analytics.
import { useEffect, useState } from 'react';
import {
  effectiveEntitlements,
  effectiveTier,
  type Entitlements,
  type Subscription,
  type SubscriptionTier,
} from '@svtrip/shared';
import { useAuth } from '../auth/AuthProvider';
import { subscribeToSubscription } from './subscriptionRepo';

export interface EntitlementsState {
  tier: SubscriptionTier;
  entitlements: Entitlements;
  subscription: Subscription | null;
  loading: boolean;
}

export function useEntitlements(): EntitlementsState {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeToSubscription(user.uid, (sub) => {
      setSubscription(sub);
      setLoading(false);
    });
  }, [user]);

  return {
    tier: effectiveTier(subscription),
    entitlements: effectiveEntitlements(subscription),
    subscription,
    loading,
  };
}
