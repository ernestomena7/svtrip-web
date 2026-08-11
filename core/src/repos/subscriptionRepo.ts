// Subscription persistence (T092, FR-027/028). The selected tier + recomputed
// entitlements are stored on providerProfiles/{uid}.subscription (owner-writable
// per rules). Billing is simulated for v1: selecting a tier activates it
// immediately. The rank-boost entitlement is denormalized onto the owner's
// listings as a public `boosted` flag so Discover can rank them without a
// traveler ever reading another provider's private subscription (T094).
import { collection, doc, getDocs, onSnapshot, query, where, writeBatch } from 'firebase/firestore';
import {
  entitlementsForTier,
  type Subscription,
  type SubscriptionTier,
} from '@svtrip/shared';
import { db } from '../firebase';
import { clearDiscoverCache } from './discoverRepo';

/** Live subscription for a provider (undefined until first load; null when none). */
export function subscribeToSubscription(
  uid: string,
  cb: (sub: Subscription | null) => void,
): () => void {
  return onSnapshot(doc(db, 'providerProfiles', uid), (snap) => {
    cb((snap.data()?.subscription as Subscription | undefined) ?? null);
  });
}

/** Activate a tier (simulated) and denormalize its rank-boost onto the owner's listings. */
export async function selectTier(uid: string, tier: SubscriptionTier): Promise<void> {
  const entitlements = entitlementsForTier(tier);
  const subscription: Subscription = {
    tier,
    entitlements,
    status: 'active',
    selectedAt: Date.now(),
  };

  const listingsSnap = await getDocs(
    query(collection(db, 'listings'), where('ownerUid', '==', uid)),
  );

  const batch = writeBatch(db);
  batch.set(doc(db, 'providerProfiles', uid), { subscription }, { merge: true });
  listingsSnap.forEach((l) => batch.update(l.ref, { boosted: entitlements.rankBoost }));

  await batch.commit();
  clearDiscoverCache();
}
