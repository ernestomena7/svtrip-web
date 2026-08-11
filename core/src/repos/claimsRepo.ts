// Claim data access (T018, feature 006).
//
// Asymmetric on purpose, like reviews in `005`: the caller's own claims are read
// live from Firestore, every write goes through the BFF. A claim's decision
// moves `ownerUid` on a catalog entry, so no client may write one — the rules
// deny it outright, and this module is the legitimate path around that.
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { BusinessClaim, ClaimStatus } from '@svtrip/shared';
import { db } from '../firebase';
import { deleteJson, getJson, postJson } from '../apiClient';

/**
 * Live subscription to the caller's own claims, newest first.
 *
 * Sorted client-side so no composite index is required — the same approach used
 * for listings, deals and reviews.
 */
export function subscribeToMyClaims(
  requesterUid: string,
  cb: (claims: BusinessClaim[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(collection(db, 'businessClaims'), where('requesterUid', '==', requesterUid));
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs
          .map((d) => ({ ...(d.data() as BusinessClaim), claimId: d.id }))
          .sort((a, b) => b.updatedAt - a.updatedAt),
      );
    },
    onError,
  );
}

/** File a claim. The server decides whether it is a claim or a handover. */
export function fileClaim(listingId: string, message?: string) {
  return postJson<{ claim: BusinessClaim }>('/claims', { listingId, message });
}

export function withdrawClaim(claimId: string) {
  return deleteJson<{ withdrawn: boolean }>(`/claims/${encodeURIComponent(claimId)}`);
}

/** Operator queue. A non-operator gets their own claims back, never the queue. */
export function fetchClaims(status: ClaimStatus = 'pending') {
  return getJson<{ claims: BusinessClaim[] }>(`/claims?status=${status}`);
}

export function decideClaim(claimId: string, decision: 'approved' | 'refused', note?: string) {
  return postJson<{ claim: BusinessClaim; warnings: string[] }>(
    `/claims/${encodeURIComponent(claimId)}/decide`,
    { decision, note },
  );
}

/** The claim a requester currently has open on a given entry, if any. */
export function pendingClaimFor(
  claims: BusinessClaim[],
  listingId: string,
): BusinessClaim | undefined {
  return claims.find((c) => c.listingId === listingId && c.status === 'pending');
}
