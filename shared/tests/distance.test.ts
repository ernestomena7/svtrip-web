// Distance between two points (feature 014, U14).
import { describe, it, expect } from 'vitest';
import { distanceKm, byDistanceFrom, formatDistanceKm } from '../src/distance.js';

// Real coordinates from the seed catalog, so the expected values mean something.
const SAN_SALVADOR = { lat: 13.6929, lng: -89.2182 };
const EL_TUNCO = { lat: 13.4936, lng: -89.3826 };
const SANTA_ANA_VOLCANO = { lat: 13.8533, lng: -89.6303 };

describe('distanceKm', () => {
  it('returns a known distance for a known pair', () => {
    // San Salvador → El Tunco is about 28 km as the crow flies. (The 35 km the
    // prototype shows is road distance, which is a different measurement and
    // not what this computes.)
    expect(distanceKm(SAN_SALVADOR, EL_TUNCO)).toBeGreaterThan(25);
    expect(distanceKm(SAN_SALVADOR, EL_TUNCO)).toBeLessThan(32);
  });

  it('is zero for a point and itself', () => {
    expect(distanceKm(EL_TUNCO, EL_TUNCO)).toBe(0);
  });

  it('is symmetric', () => {
    expect(distanceKm(SAN_SALVADOR, EL_TUNCO)).toBeCloseTo(
      distanceKm(EL_TUNCO, SAN_SALVADOR),
      10,
    );
  });

  it('handles a traveler on the other side of the world', () => {
    // A traveler opening the app from Tokyo is an edge case the spec names.
    // The number is large and useless as "nearby" — it must still be a number.
    const tokyo = { lat: 35.68, lng: 139.69 };
    const d = distanceKm(tokyo, EL_TUNCO);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(10_000);
  });
});

describe('byDistanceFrom', () => {
  it('orders nearest first', () => {
    const ordered = byDistanceFrom([SANTA_ANA_VOLCANO, EL_TUNCO], SAN_SALVADOR);
    expect(ordered[0]).toBe(EL_TUNCO);
  });

  it('NEVER filters — every entry comes back', () => {
    // Same rule `rankForTraveler` follows in feature 013: distance decides the
    // ORDER, never the membership. A section that silently drops places is one
    // a traveler cannot trust.
    const input = [SANTA_ANA_VOLCANO, EL_TUNCO, SAN_SALVADOR];
    expect(byDistanceFrom(input, SAN_SALVADOR)).toHaveLength(3);
  });

  it('does not mutate its input', () => {
    const input = [SANTA_ANA_VOLCANO, EL_TUNCO];
    const copy = [...input];
    byDistanceFrom(input, SAN_SALVADOR);
    expect(input).toEqual(copy);
  });

  it('returns an empty array unchanged', () => {
    expect(byDistanceFrom([], SAN_SALVADOR)).toEqual([]);
  });
});

describe('formatDistanceKm', () => {
  it('returns undefined with no distance — the DEFAULT case', () => {
    // What an unanswered prompt, a refusal, and a fix that has not arrived yet
    // all look like. A card lays out for this, not around it (FR-049).
    expect(formatDistanceKm(undefined)).toBeUndefined();
  });

  it('avoids "0 km", which reads as broken', () => {
    expect(formatDistanceKm(0.3)).toBe('<1 km');
  });

  it('rounds to whole kilometres', () => {
    expect(formatDistanceKm(28.4)).toBe('28 km');
    expect(formatDistanceKm(28.6)).toBe('29 km');
  });

  it('refuses a non-finite value rather than rendering NaN', () => {
    expect(formatDistanceKm(Number.NaN)).toBeUndefined();
  });
});
