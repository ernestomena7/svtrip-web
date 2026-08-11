// SC-009: a card and a profile must never disagree about a score. Every surface
// calls scoreSignalFor, so these cases are the contract that keeps them aligned.
import { describe, expect, it } from 'vitest';
import type { Place, Recommendation } from '../src/types.js';
import { hasReviewAverage, scoreSignalFor, scoreSignalForRecommendation } from '../src/score.js';

function place(over: Partial<Place>): Place {
  return {
    placeId: 'p1',
    name: 'Test',
    description: '',
    moods: [],
    rating: 0,
    lat: 13.7,
    lng: -89.2,
    photos: [],
    trending: false,
    colonialTown: false,
    keywords: [],
    source: 'seed',
    ...over,
  } as Place;
}

describe('scoreSignalFor', () => {
  it('shows the real average once reviews exist', () => {
    expect(scoreSignalFor(place({ ratingAvg: 4.3333, ratingCount: 3 }))).toEqual({
      kind: 'average',
      value: 4.3333,
      count: 3,
    });
  });

  it('shows a low average unchanged — the average must be real', () => {
    // The team's explicit decision: it does not matter whether the average goes
    // up or down, it is what travelers actually said.
    expect(scoreSignalFor(place({ rating: 4.8, ratingAvg: 1, ratingCount: 1 }))).toEqual({
      kind: 'average',
      value: 1,
      count: 1,
    });
  });

  it('never substitutes an editorial rating for a missing average', () => {
    const signal = scoreSignalFor(place({ rating: 4.7 }));
    expect(signal).toEqual({ kind: 'editorial' });
    expect(signal).not.toHaveProperty('value');
  });

  it('shows nothing for a provider listing with no reviews', () => {
    // Listings have no hand-assigned editorial rating to fall back on.
    expect(scoreSignalFor(place({ source: 'listing', rating: 4.9 }))).toEqual({ kind: 'none' });
  });

  it('shows nothing for a curated entry with no rating and no reviews', () => {
    expect(scoreSignalFor(place({ rating: 0 }))).toEqual({ kind: 'none' });
  });

  it('distrusts an average left behind without a count (FR-030)', () => {
    // The server deletes ratingAvg when the last review goes; a stale average
    // with ratingCount 0 must not resurrect itself.
    expect(scoreSignalFor(place({ ratingAvg: 5, ratingCount: 0 }))).toEqual({ kind: 'none' });
  });

  it('handles a missing source object', () => {
    expect(scoreSignalFor(undefined)).toEqual({ kind: 'none' });
  });
});

describe('hasReviewAverage', () => {
  it('is keyed on the count, not the average', () => {
    expect(hasReviewAverage({ ratingCount: 1 })).toBe(true);
    expect(hasReviewAverage({ ratingCount: 0, ratingAvg: 4.5 })).toBe(false);
    expect(hasReviewAverage({})).toBe(false);
  });
});

describe('scoreSignalForRecommendation', () => {
  const rec = (over: Partial<Recommendation>): Recommendation => ({
    refId: 'p1',
    kind: 'place',
    name: 'Test',
    lat: 13.7,
    lng: -89.2,
    ...over,
  });

  it('agrees with the place decision for a catalog entry', () => {
    expect(scoreSignalForRecommendation(rec({ ratingAvg: 4.5, ratingCount: 2 }))).toEqual({
      kind: 'average',
      value: 4.5,
      count: 2,
    });
    expect(scoreSignalForRecommendation(rec({ rating: 4.6 }))).toEqual({ kind: 'editorial' });
  });

  it('maps isListing to the listing rule', () => {
    expect(scoreSignalForRecommendation(rec({ rating: 4.6, isListing: true }))).toEqual({
      kind: 'none',
    });
  });
});
