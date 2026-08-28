// The optional price band (feature 014, FR-065–FR-070).
import { describe, it, expect } from 'vitest';
import {
  PRICE_BANDS,
  isPriceBand,
  priceBandFor,
  priceBandLabelKey,
  type PriceBand,
} from '../src/pricing.js';
import { isPublishable, CONTENT_VERSION } from '../src/publication.js';

describe('the vocabulary', () => {
  it('is a small fixed set, stored as keys', () => {
    expect(PRICE_BANDS).toEqual(['free', 'low', 'medium', 'high']);
  });

  it('resolves a label through i18n rather than storing display text', () => {
    // "Gratis"/"Free" has to translate. Storing the rendered string would
    // freeze it in whichever language the owner happened to be using.
    expect(priceBandLabelKey('free')).toBe('pricing.free');
  });

  it('accepts only the four bands', () => {
    expect(isPriceBand('free')).toBe(true);
    expect(isPriceBand('$$')).toBe(false);
    expect(isPriceBand('6')).toBe(false);
    expect(isPriceBand(undefined)).toBe(false);
  });
});

describe('an entry with no band — the DEFAULT case, not the exception', () => {
  it('resolves to undefined so the card omits the line', () => {
    // Every seed place and every listing whose owner has not set one lands
    // here. A placeholder, a dash or a guess would all be fabrications.
    expect(priceBandFor({})).toBeUndefined();
  });

  it('resolves to undefined for a value that is not a band', () => {
    expect(priceBandFor({ priceBand: 'cheap' })).toBeUndefined();
  });

  it('returns the band when there is one', () => {
    expect(priceBandFor({ priceBand: 'medium' })).toBe('medium');
  });
});

describe('the band must NOT join the publication floor', () => {
  // Feature 006's floor guards regression only. Making the band required would
  // unpublish live businesses on deploy — the exact failure that made the floor
  // non-retroactive in the first place.
  const publishable = {
    name: 'Café del Cerro',
    description: 'Una terraza con vista',
    photos: ['https://example.com/a.jpg'],
    businessType: 'restaurant-cafe',
    contentVersion: CONTENT_VERSION,
    // Both languages: the floor requires them for a post-006 entry.
    nameI18n: { es: 'Café del Cerro', en: 'Hill Coffee' },
    descriptionI18n: { es: 'Una terraza con vista', en: 'A terrace with a view' },
  };

  it('a listing with no band is still publishable', () => {
    expect(isPublishable(publishable)).toBe(true);
  });

  it('adding a band changes nothing about publishability', () => {
    const withBand = { ...publishable, priceBand: 'high' as PriceBand };
    expect(isPublishable(withBand)).toBe(isPublishable(publishable));
  });
});
