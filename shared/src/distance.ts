// Distance between two points on Earth, for ordering the Discover carousel
// (feature 014, FR-053).
//
// This lives in `shared/` rather than `core/` by the usual rule — does the Node
// server run it? — and the answer is that it MUST be able to, even though today
// only the client calls it. That constraint is the point: the traveler's
// position never leaves the device (FR-047), so distance is computed here,
// beside the catalog coordinates the client already holds, and no request ever
// carries a coordinate.
//
// No library. Haversine is ten lines, and a dependency for ten lines is a
// dependency to keep patched.

/** Anything carrying coordinates — a `Place`, a `Listing`, or a device fix. */
export interface Coordinates {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometres.
 *
 * Haversine rather than a planar approximation: El Salvador is small enough that
 * the two barely differ, but the formula costs the same and does not quietly
 * degrade for a traveler who opens the app from another country — a case the
 * spec calls out (see the edge cases in spec.md).
 */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Order entries by distance from a point, nearest first.
 *
 * Returns a NEW array and **never filters** — every entry passed in comes back
 * out. That is the same rule `rankForTraveler` follows in feature 013, and for
 * the same reason: a section that silently drops places is a section a traveler
 * cannot trust. Distance decides the ORDER, never the membership.
 */
export function byDistanceFrom<T extends Coordinates>(entries: readonly T[], from: Coordinates): T[] {
  return [...entries].sort((a, b) => distanceKm(from, a) - distanceKm(from, b));
}

/**
 * How a distance is written on a card.
 *
 * Returns `undefined` when there is no position, which is the case a card must
 * lay out for by default rather than as an exception (FR-049): an unanswered
 * prompt, a refusal, and a fix that has not arrived yet all look like this.
 */
export function formatDistanceKm(km: number | undefined): string | undefined {
  if (km === undefined || !Number.isFinite(km)) return undefined;
  // Under a kilometre, "0 km" reads as broken. Round up to the first whole unit
  // rather than showing a decimal the traveler has no use for.
  if (km < 1) return '<1 km';
  return `${Math.round(km)} km`;
}
