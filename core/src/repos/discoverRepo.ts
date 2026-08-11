// Discover data access (T053): fetch the public places/events catalog once and
// derive For You, mood filtering, and spotlight sections client-side. The
// catalog is small (curated seed + provider listings), so a single collection
// read avoids needing Firestore composite indexes for this MVP.
import { collection, getDocs } from 'firebase/firestore';
import type { Listing, Place, SvEvent } from '@svtrip/shared';
import { publicVisibility } from '@svtrip/shared';
import { db } from '../firebase';

let placesCache: Place[] | null = null;
let eventsCache: SvEvent[] | null = null;

/** Present an active provider listing as a discoverable Place (T080, FR-024). */
export function listingToPlace(l: Listing): Place {
  return {
    placeId: l.listingId,
    name: l.name,
    description: l.description,
    moods: l.moods,
    categories: l.categories,
    rating: l.rating,
    lat: l.lat,
    lng: l.lng,
    photos: l.photos,
    // Carried from the document rather than hardcoded to false: the curated
    // catalog now lives in `listings` (it was handed to a provider account so it
    // could be edited), and hardcoding these emptied Discover's "Trending" and
    // "Colonial towns" rows entirely. Security rules pin both fields so a
    // provider cannot write themselves into those rows.
    trending: l.trending === true,
    colonialTown: l.colonialTown === true,
    keywords: l.keywords?.length ? l.keywords : [l.name.toLowerCase()],
    source: 'listing',
    boosted: l.boosted === true,
    // Carried through so the profile can show owner-only affordances and the
    // real review aggregate rather than the legacy `rating` field (feature 005).
    ownerUid: l.ownerUid,
    businessType: l.businessType,
    bannerURL: l.bannerURL,
    gallery: l.gallery,
    services: l.services,
    menuImages: l.menuImages,
    ratingAvg: l.ratingAvg,
    ratingCount: l.ratingCount,
    // Bilingual content and the 006 stamp travel with the entry: the
    // catalog readers are what decide visibility and language.
    nameI18n: l.nameI18n,
    descriptionI18n: l.descriptionI18n,
    contentVersion: l.contentVersion,
    phone: l.phone,
    whatsapp: l.whatsapp,
  };
}

export async function fetchPlaces(): Promise<Place[]> {
  if (placesCache) return placesCache;
  const [placesSnap, listingsSnap] = await Promise.all([
    getDocs(collection(db, 'places')),
    getDocs(collection(db, 'listings')),
  ]);
  // Keyed by id, with listings last, exactly like the server's catalog merge.
  // A plain concat would double every entry whose id exists in both collections
  // — which is one `npm run seed` away, now that the curated catalog lives in
  // `listings` and seeding would recreate the same ids under `places`.
  const byId = new Map<string, Place>();
  for (const d of placesSnap.docs) byId.set(d.id, { ...(d.data() as Place), placeId: d.id });
  for (const d of listingsSnap.docs) {
    const listing = { ...(d.data() as Listing), listingId: d.id };
    // Unfinished entries are visible to their manager only (feature 006,
    // FR-012). `publicVisibility` exempts anything authored before that feature,
    // which is why the 18 photoless catalog entries stay in the catalog.
    if (publicVisibility(listing)) byId.set(d.id, listingToPlace(listing));
  }
  placesCache = [...byId.values()];
  return placesCache;
}

/** Invalidate the catalog cache (e.g. after creating/editing a listing). */
export function clearDiscoverCache(): void {
  placesCache = null;
  eventsCache = null;
}

/**
 * Write a fresh score into the cached catalog entry (feature 005, SC-009).
 *
 * The score is denormalized onto the target document and written by the BFF, so
 * a traveler who reviews a business and then walks back to Discover would
 * otherwise see the card's *cached* score contradict the profile they just came
 * from. Patching in place is enough — the rest of the entry has not changed, so
 * throwing the whole catalog away would only cost a round trip.
 */
export function patchCachedScore(
  placeId: string,
  score: { ratingAvg?: number; ratingCount?: number },
): void {
  if (!placesCache) return;
  placesCache = placesCache.map((p) =>
    p.placeId === placeId
      ? { ...p, ratingAvg: score.ratingAvg, ratingCount: score.ratingCount }
      : p,
  );
}

export async function fetchEvents(): Promise<SvEvent[]> {
  if (eventsCache) return eventsCache;
  const snap = await getDocs(collection(db, 'events'));
  eventsCache = snap.docs.map((d) => ({ ...(d.data() as SvEvent), eventId: d.id }));
  return eventsCache;
}

function byRatingDesc(a: Place, b: Place): number {
  return b.rating - a.rating;
}

/**
 * Ranking comparator (T094, FR-027): sponsored (boosted) providers surface
 * first, then by rating. Boost only reorders — it never injects places the
 * filter didn't already select.
 */
function byBoostThenRating(a: Place, b: Place): number {
  if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
  return byRatingDesc(a, b);
}

/** "For You": places whose moods intersect the user's selected vibes (FR-006). */
export function forYou(places: Place[], vibes: string[]): Place[] {
  if (vibes.length === 0) return [...places].sort(byBoostThenRating);
  const vibeSet = new Set(vibes);
  return places.filter((p) => p.moods.some((m) => vibeSet.has(m))).sort(byBoostThenRating);
}

export function byMood(places: Place[], mood: string): Place[] {
  return places.filter((p) => p.moods.includes(mood)).sort(byBoostThenRating);
}

export function trendingPlaces(places: Place[]): Place[] {
  return places.filter((p) => p.trending).sort(byRatingDesc);
}

export function colonialTowns(places: Place[]): Place[] {
  return places.filter((p) => p.colonialTown).sort(byRatingDesc);
}

export function trendingEvents(events: SvEvent[]): SvEvent[] {
  return events.filter((e) => e.trending).sort((a, b) => a.startAt - b.startAt);
}
