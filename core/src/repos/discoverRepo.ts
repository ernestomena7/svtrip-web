// Discover data access (T053): fetch the public places/events catalog once and
// derive For You, mood filtering, and spotlight sections client-side. The
// catalog is small (curated seed + provider listings), so a single collection
// read avoids needing Firestore composite indexes for this MVP.
import type { Listing, Place, SvEvent } from '@svtrip/shared';
import { byBoostThenRating, byRatingDesc, travelerVisible } from '@svtrip/shared';
import { supabase } from '../supabase';
import { rowsOf } from '../db/live';
import { fromRow } from '@svtrip/shared';
import { readThrough } from '../db/offlineCache';

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
    covered: l.covered,
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
    // Feature 013 added this to the SERVER mapper and not to this one.
    // Nothing on the client read it, so the asymmetry stayed invisible —
    // which is how the original omission hid too.
    createdAt: l.createdAt,
    // Feature 014. Copied in BOTH mappers deliberately; see `Place.priceBand`.
    priceBand: l.priceBand,
    // Feature 020, and the THIRD time this repo records the same trap. Both of
    // these must be copied in BOTH mappers: without `reservationsEnabled` the
    // "Reservar" button never appears, and without `openingHours` the slot
    // picker has nothing to validate a moment against.
    reservationsEnabled: l.reservationsEnabled === true,
    openingHours: l.openingHours,
  };
}

export async function fetchPlaces(): Promise<Place[]> {
  if (placesCache) return placesCache;
  // Offline (FR-019): the last catalog this device loaded is served when the network read fails.
  const { places, listings } = await readThrough('catalog', async () => {
    const [p, l] = await Promise.all([supabase.from('places').select('*'), supabase.from('listings').select('*')]);
    return {
      places: rowsOf(p).map((r) => fromRow<Place>('places', r)),
      listings: rowsOf(l).map((r) => fromRow<Listing>('listings', r)),
    };
  });
  const byId = new Map<string, Place>();
  for (const place of places) byId.set(place.placeId, place);
  for (const listing of listings) {
    if (travelerVisible(listing)) byId.set(listing.listingId, listingToPlace(listing));
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
  eventsCache = await readThrough('events', async () =>
    rowsOf(await supabase.from('events').select('*')).map((r) => fromRow<SvEvent>('events', r)),
  );
  return eventsCache;
}

// `byRatingDesc` and `byBoostThenRating` moved to shared/src/placeOrder.ts at feature 024, so the
// MCP connector orders exactly as Discover does.

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
