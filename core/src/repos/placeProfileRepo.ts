// Data access for the business profile screen (feature 005).
//
// A profile can be either a provider-owned listing or a curated catalog
// destination — the spec decided both open the same screen (FR-004) — so this
// resolves an id against whichever it turns out to be, and reports which.
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { Deal, Listing, Place } from '@svtrip/shared';
import { db } from '../firebase';
import { fetchPlaces, listingToPlace, patchCachedScore } from './discoverRepo';
import { fetchActiveDeals } from './dealsRepo';

export type ProfileTargetKind = 'place' | 'listing';

export interface ProfileTarget {
  place: Place;
  kind: ProfileTargetKind;
  /** Present only for provider listings; curated destinations have no owner. */
  ownerUid?: string;
  /** Exists but is not publicly visible — only its manager may see the profile. */
  unfinished?: boolean;
}

/**
 * Resolve a profile target by id.
 *
 * `fetchPlaces()` already merges the curated catalog with active provider
 * listings and caches the result, so this reuses it rather than adding a second
 * source of truth that could disagree with what Discover shows.
 */
export async function fetchProfileTarget(id: string): Promise<ProfileTarget | null> {
  const places = await fetchPlaces();
  const place = places.find((p) => p.placeId === id);
  if (place) {
    return { place, kind: place.source === 'listing' ? 'listing' : 'place' };
  }

  // Not in the traveler-visible catalog. It may still exist and simply be
  // unfinished (feature 006) — a promotion or a saved AI Guide plan can link
  // straight here. Its manager must still be able to open it; everyone else gets
  // an explained message rather than "no longer available", which would be a lie.
  const snap = await getDoc(doc(db, 'listings', id));
  if (!snap.exists()) return null;
  const listing = { ...(snap.data() as Listing), listingId: id };
  return { place: listingToPlace(listing), kind: 'listing', unfinished: true };
}

/** The business's currently active promotions (FR-009). */
export async function fetchProfileDeals(targetId: string): Promise<Deal[]> {
  const deals = await fetchActiveDeals();
  return deals.filter((d) => d.listingId === targetId);
}

export interface TargetScore {
  ratingAvg?: number;
  ratingCount?: number;
}

/**
 * Live subscription to a target's score aggregate (SC-009).
 *
 * The catalog itself is fetched once and cached, which is fine for names and
 * photos but wrong for the score: it is written by the BFF *after* a review
 * lands, so a cached snapshot would leave the traveler staring at the profile
 * they just reviewed with no average on it. Subscribing to the one document that
 * carries the aggregate keeps the profile live, and patching the cache on the way
 * through keeps the Discover card from contradicting it.
 */
export function subscribeToTargetScore(
  targetId: string,
  kind: ProfileTargetKind,
  cb: (score: TargetScore) => void,
): () => void {
  const ref = doc(db, kind === 'listing' ? 'listings' : 'places', targetId);
  return onSnapshot(
    ref,
    (snap) => {
      const data = snap.data() as TargetScore | undefined;
      const score: TargetScore = { ratingAvg: data?.ratingAvg, ratingCount: data?.ratingCount };
      patchCachedScore(targetId, score);
      cb(score);
    },
    // A dropped listener must not invent a score; the last known one stands.
    () => {},
  );
}

// The score-display decision moved to lib/score.ts once cards had to make the
// same call — see `scoreSignalFor` there. Keeping a second copy here is exactly
// how a card and a profile end up disagreeing (SC-009).
