// Review data access (T038, feature 005).
//
// Asymmetric on purpose: READS come straight from Firestore (public, real-time),
// WRITES go through the BFF so the score aggregate is recomputed in the same
// operation and the ownership checks happen server-side (contracts §1).
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Review } from '@svtrip/shared';
import { reviewIdFor } from '@svtrip/shared';
import { db } from '../firebase';
import { postJson, deleteJson } from '../apiClient';

/**
 * Live subscription to a target's reviews, newest first.
 *
 * Sorted client-side so no composite index is required — the same approach used
 * for provider listings and deals.
 */
export function subscribeToReviews(
  targetId: string,
  cb: (reviews: Review[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(collection(db, 'reviews'), where('targetId', '==', targetId));
  return onSnapshot(
    q,
    (snap) => {
      const reviews = snap.docs
        .map((d) => ({ ...(d.data() as Review), reviewId: d.id }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      cb(reviews);
    },
    onError,
  );
}

/** Find the caller's own review in a loaded list, if they have one. */
export function findOwnReview(reviews: Review[], uid: string | undefined): Review | undefined {
  if (!uid) return undefined;
  return reviews.find((r) => r.authorUid === uid);
}

/** The deterministic id the caller's review would have. */
export function ownReviewId(targetId: string, uid: string): string {
  return reviewIdFor(targetId, uid);
}

// --- Writes (all via the BFF) ----------------------------------------------

export function submitReview(targetId: string, rating: number, comment?: string) {
  return postJson<{ review: Review }>('/reviews', { targetId, rating, comment });
}

export function removeReview(targetId: string) {
  return deleteJson<{ deleted: boolean }>(`/reviews/${encodeURIComponent(targetId)}`);
}

export function submitReply(reviewId: string, text: string) {
  return postJson<{ replied: boolean }>(`/reviews/${encodeURIComponent(reviewId)}/reply`, { text });
}

export function removeReply(reviewId: string) {
  return deleteJson<{ deleted: boolean }>(`/reviews/${encodeURIComponent(reviewId)}/reply`);
}

export function reportReview(reviewId: string, reason?: string) {
  return postJson<{ reported: boolean }>(`/reviews/${encodeURIComponent(reviewId)}/report`, {
    reason,
  });
}
