// @vitest-environment node
//
// `listingToPlace` on the CLIENT side (feature 014, U6).
//
// The twin of `server/tests/catalogMapping.test.ts`. Two mappers produce the
// same shape from the same input, and a field copied in one and not the other
// is a defect that hides: it works in the guide and not on a card, or the
// reverse, with nothing failing either way.
//
// That is not hypothetical here. Feature 013 fixed `createdAt` in the server
// mapper and left this one without it. Nothing on the client read the field, so
// the asymmetry survived the feature that was created to fix it.
import { describe, it, expect, vi } from 'vitest';
import type { Listing } from '@svtrip/shared';

// The module imports the Firebase Web SDK at load. The mapping itself is pure.
vi.mock('../src/firebase', () => ({ db: {} }));

const { listingToPlace } = await import('../src/repos/discoverRepo');

const listing: Listing = {
  listingId: 'l1',
  ownerUid: 'owner-1',
  name: 'Café del Cerro',
  description: 'Una terraza con vista',
  photos: ['https://example.com/a.jpg'],
  lat: 13.7,
  lng: -89.2,
  openingHours: [],
  moods: ['relax'],
  categories: ['coffee'],
  rating: 4.6,
  active: true,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  priceBand: 'medium',
};

describe('fields that must survive the mapping', () => {
  const place = listingToPlace(listing);

  it('copies the price band (feature 014)', () => {
    expect(place.priceBand).toBe('medium');
  });

  it('copies createdAt — the field the SERVER mapper had and this one did not', () => {
    expect(place.createdAt).toBe(1_700_000_000_000);
  });

  it('produces the same shape as the server mapper for the fields both carry', () => {
    // Not a deep equality — the two differ legitimately in how they derive the
    // id and in their tolerance for missing input. This pins the overlap that
    // must not drift.
    expect(place.ownerUid).toBe('owner-1');
    expect(place.source).toBe('listing');
    expect(place.ratingAvg).toBe(listing.ratingAvg);
    expect(place.businessType).toBe(listing.businessType);
  });
});

describe('an absent price band', () => {
  it('comes through as undefined rather than a placeholder', () => {
    expect(listingToPlace({ ...listing, priceBand: undefined }).priceBand).toBeUndefined();
  });
});
