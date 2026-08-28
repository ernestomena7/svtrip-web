// Ranking and claims (feature 013, T008 + T017).
//
// Two properties are load-bearing and everything else supports them:
//
//   1. **Relevance is never sacrificed to freshness.** An entry already seen
//      still ranks into a plan when it is the only fit (FR-009). A guide that
//      withholds the only correct answer because it said it once has stopped
//      answering the question.
//   2. **A claim is true or absent.** Never "close enough", never inferred from
//      a commercial arrangement.
import { describe, it, expect } from 'vitest';
import {
  NEW_WINDOW_MS,
  POPULAR_THRESHOLD,
  claimFor,
  pickIntroduction,
  rankForTraveler,
  type RankableEntry,
  type RankingContext,
} from '../src/promotion.js';
import type { ExposureEntry } from '../src/types.js';

const NOW = 1_800_000_000_000;

const ctx = (seen: ExposureEntry[] = []): RankingContext => ({ seen, now: NOW });
const shown = (catalogId: string, takenUp = false): ExposureEntry => ({
  catalogId,
  shownAt: NOW - 1000,
  ...(takenUp ? { takenUpAt: NOW - 500 } : {}),
});

const entry = (id: string, extra: Partial<RankableEntry> = {}): RankableEntry => ({ id, ...extra });

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

describe('claimFor — a claim is true or it is absent', () => {
  it('well-rated only with a real traveler review average', () => {
    expect(claimFor(entry('a', { ratingAvg: 4.6, ratingCount: 12 }), ctx())).toBe('well-rated');
  });

  it('an entry with NO reviews is never well rated', () => {
    // Absence of reviews is not a low rating and is not a claim at all
    // (FR-016). 33 of 36 catalog entries are in this state today.
    expect(claimFor(entry('a'), ctx())).toBeUndefined();
    expect(claimFor(entry('a', { ratingCount: 0 }), ctx())).not.toBe('well-rated');
  });

  it('an EDITORIAL rating is not a review average', () => {
    // A curated entry with a hand-assigned score still cannot be called well
    // rated. Only travelers can make that true — `scoreSignalFor` returns
    // `editorial`, not `average`, and this routes through it.
    expect(claimFor(entry('a', { rating: 5, source: 'seed' }), ctx())).not.toBe('well-rated');
  });

  it('new, when it entered the catalog inside the window', () => {
    expect(claimFor(entry('a', { createdAt: NOW - 1000 }), ctx())).toBe('new');
  });

  it('NOT new once the window has passed', () => {
    expect(claimFor(entry('a', { createdAt: NOW - NEW_WINDOW_MS - 1 }), ctx())).toBeUndefined();
  });

  it('an entry with no createdAt is never new', () => {
    // Seed places predate the listings collection. Absence is not newness.
    expect(claimFor(entry('a', { source: 'seed' }), ctx())).toBeUndefined();
  });

  it('popular, above the engagement threshold', () => {
    expect(claimFor(entry('a', { engagementCount: POPULAR_THRESHOLD }), ctx())).toBe('popular');
    expect(claimFor(entry('a', { engagementCount: POPULAR_THRESHOLD - 1 }), ctx())).toBeUndefined();
  });

  it('a BOOSTED entry with no reviews carries NO claim (FR-018)', () => {
    // The line the product cannot cross. A card shows a number; the guide makes
    // an assertion, and "muy bien calificado" about a paid placement with zero
    // reviews is the product lying in a complete sentence.
    expect(claimFor(entry('a', { boosted: true }), ctx())).toBeUndefined();
  });

  it('a boosted entry WITH reviews is well rated because of the reviews', () => {
    const claim = claimFor(entry('a', { boosted: true, ratingAvg: 4.8, ratingCount: 20 }), ctx());
    expect(claim).toBe('well-rated');
  });

  it('prefers the strongest true claim', () => {
    const both = entry('a', { ratingAvg: 4.5, ratingCount: 9, createdAt: NOW - 1000 });
    expect(claimFor(both, ctx())).toBe('well-rated');
  });
});

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

describe('rankForTraveler', () => {
  it('NEVER filters — relevance was already decided (FR-009)', () => {
    // THE property. Everything passed in comes back out; freshness reorders the
    // relevant set, it does not shrink it.
    const entries = [entry('a'), entry('b'), entry('c')];
    const seen = [shown('a'), shown('b'), shown('c')];
    const ranked = rankForTraveler(entries, ctx(seen));
    expect(ranked).toHaveLength(3);
    expect(ranked.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('the only fit is still returned even when already seen', () => {
    const ranked = rankForTraveler([entry('el-tunco')], ctx([shown('el-tunco')]));
    expect(ranked.map((e) => e.id)).toEqual(['el-tunco']);
  });

  it('puts unseen before seen', () => {
    const ranked = rankForTraveler([entry('visto'), entry('nuevo')], ctx([shown('visto')]));
    expect(ranked[0].id).toBe('nuevo');
  });

  it('among seen, ignored ranks above taken-up', () => {
    // Something shown and passed over is a weaker suggestion than something the
    // traveler actually liked — but both rank below anything unseen.
    const ranked = rankForTraveler(
      [entry('gustado'), entry('ignorado')],
      ctx([shown('gustado', true), shown('ignorado')]),
    );
    expect(ranked.map((e) => e.id)).toEqual(['ignorado', 'gustado']);
  });

  it('orders by claim strength among equals', () => {
    const ranked = rankForTraveler(
      [
        entry('sin-nada'),
        entry('nuevo', { createdAt: NOW - 1000 }),
        entry('calificado', { ratingAvg: 4.7, ratingCount: 8 }),
      ],
      ctx(),
    );
    expect(ranked.map((e) => e.id)).toEqual(['calificado', 'nuevo', 'sin-nada']);
  });

  it('boost is the LAST tiebreak, never ahead of a real signal', () => {
    const ranked = rankForTraveler(
      [entry('pagado', { boosted: true }), entry('calificado', { ratingAvg: 4.9, ratingCount: 30 })],
      ctx(),
    );
    // The reviewed entry wins. A boost cannot buy its way past evidence.
    expect(ranked[0].id).toBe('calificado');
  });

  it('is deterministic', () => {
    const entries = [entry('c'), entry('a'), entry('b')];
    const a = rankForTraveler(entries, ctx()).map((e) => e.id);
    const b = rankForTraveler(entries, ctx()).map((e) => e.id);
    expect(a).toEqual(b);
  });

  it('does not mutate its input', () => {
    const entries = [entry('c'), entry('a')];
    rankForTraveler(entries, ctx());
    expect(entries.map((e) => e.id)).toEqual(['c', 'a']);
  });

  it('a traveler with no record is served normally (FR-007)', () => {
    const entries = [entry('a'), entry('b')];
    expect(rankForTraveler(entries, ctx()).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// The introduction
// ---------------------------------------------------------------------------

describe('pickIntroduction', () => {
  it('picks the best unseen candidate', () => {
    const pick = pickIntroduction(
      [entry('visto'), entry('nuevo', { ratingAvg: 4.5, ratingCount: 5 })],
      ctx([shown('visto')]),
    );
    expect(pick?.id).toBe('nuevo');
  });

  it('returns NOTHING when everything has been seen — none is manufactured (FR-014)', () => {
    const entries = [entry('a'), entry('b')];
    expect(pickIntroduction(entries, ctx([shown('a'), shown('b')]))).toBeUndefined();
  });

  it('never picks something already in the plan', () => {
    const pick = pickIntroduction([entry('a'), entry('b')], ctx(), ['a']);
    expect(pick?.id).toBe('b');
  });

  it('returns nothing when the only unseen entry is excluded', () => {
    expect(pickIntroduction([entry('a')], ctx(), ['a'])).toBeUndefined();
  });

  it('an unseen entry with no claim is still introducible', () => {
    // The case that lets this ship: 33 of 36 catalog entries qualify for no
    // claim, and "you haven't tried this" needs no supporting evidence.
    const pick = pickIntroduction([entry('sin-nada')], ctx());
    expect(pick?.id).toBe('sin-nada');
    expect(claimFor(pick!, ctx())).toBeUndefined();
  });
});
