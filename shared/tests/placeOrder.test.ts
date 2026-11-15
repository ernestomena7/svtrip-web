// Feature 024: Discover's comparator, now shared by the app and the MCP connector. NEW FILE; the
// behaviour is unchanged from core (its byMood/forYou tests still run through it).
import { describe, it, expect } from 'vitest';
import { byBoostThenRating, byRatingDesc } from '../src/placeOrder.js';
import type { Place } from '../src/types.js';

const p = (placeId: string, over: Partial<Place> = {}) => ({ placeId, rating: 0, ...over }) as Place;
const ids = (xs: Place[]) => xs.map((x) => x.placeId);

describe('Discover ordering', () => {
  it('orders by the traveler average when there is one, else by the editorial rating', () => {
    // Pinned AS IT IS: an entry with no reviews still sorts by its editorial number. The moved
    // comment talks about averages winning; the code compares `ratingAvg ?? rating`, so a 4.9
    // editorial still sorts above a real 4.8. Recorded, not changed — this feature only moved it.
    const real = p('real', { ratingAvg: 4.8, ratingCount: 30, rating: 0 });
    const editorial = p('editorial', { rating: 4.9 });
    expect(ids([editorial, real].sort(byRatingDesc))).toEqual(['editorial', 'real']);
    expect(ids([p('a', { ratingAvg: 4.1 }), p('b', { ratingAvg: 4.6 })].sort(byRatingDesc))).toEqual(['b', 'a']);
  });

  it('boost only reorders: a boosted place comes first, the rest by rating', () => {
    const list = [p('top', { ratingAvg: 5 }), p('boosted', { boosted: true, ratingAvg: 3 }), p('mid', { ratingAvg: 4 })];
    expect(ids(list.sort(byBoostThenRating))).toEqual(['boosted', 'top', 'mid']);
  });

  it('missing scores sort as 0, never as NaN', () => {
    const list = [p('none', { rating: undefined as unknown as number }), p('some', { ratingAvg: 2 })];
    expect(ids(list.sort(byRatingDesc))).toEqual(['some', 'none']);
  });
});
