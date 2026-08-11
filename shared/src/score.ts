// The single place that decides what score a business shows (T042/T043/T044,
// feature 005 — FR-030, FR-047, FR-048; SC-009).
//
// SC-009 says a card and a profile must never disagree about a business's score.
// The only way to guarantee that is for every surface to derive the answer from
// the same function, so this module owns the decision and the components just
// render what it returns.
//
// The team's rule: *a displayed average must be real*. Two consequences:
//   - Zero reviews means NO average — not 0.0, not the editorial rating.
//   - A curated editorial rating is a different kind of claim, so it renders as
//     its own labelled signal and never in the average's slot.
import type { Place, Recommendation } from './types.js';

/** What a surface should render for a business's score. Exactly one applies. */
export type ScoreSignal =
  /** A real traveler average. `count` is always ≥ 1. */
  | { kind: 'average'; value: number; count: number }
  /** Curated catalog entry with an editorial rating but no reviews yet. */
  | { kind: 'editorial' }
  /** Nothing to show — render no score at all rather than a placeholder. */
  | { kind: 'none' };

/** The fields a score decision depends on. */
export type ScoreSource = Pick<Place, 'rating' | 'ratingAvg' | 'ratingCount' | 'source'>;

/**
 * Whether a review average may be displayed at all.
 *
 * Keyed on `ratingCount`, not on `ratingAvg`: the count is what makes the average
 * meaningful, and the server deletes `ratingAvg` when the last review goes away
 * (FR-030) — so a lingering average without a count must not be trusted.
 */
export function hasReviewAverage(source: Partial<ScoreSource>): boolean {
  return typeof source.ratingCount === 'number' && source.ratingCount > 0;
}

export function scoreSignalFor(source: Partial<ScoreSource> | undefined): ScoreSignal {
  if (!source) return { kind: 'none' };
  if (hasReviewAverage(source) && typeof source.ratingAvg === 'number') {
    return { kind: 'average', value: source.ratingAvg, count: source.ratingCount! };
  }
  // Editorial ratings exist only on curated catalog entries; a provider-created
  // listing has no hand-assigned rating to fall back on.
  if (source.source !== 'listing' && typeof source.rating === 'number' && source.rating > 0) {
    return { kind: 'editorial' };
  }
  return { kind: 'none' };
}

/**
 * Same decision for an AI Guide recommendation card.
 *
 * `Recommendation` carries `isListing` where `Place` carries `source`, so this
 * translates rather than duplicating the rules — the guide's cards must agree
 * with Discover's cards and with the profile (SC-009).
 */
export function scoreSignalForRecommendation(rec: Recommendation): ScoreSignal {
  return scoreSignalFor({
    rating: rec.rating,
    ratingAvg: rec.ratingAvg,
    ratingCount: rec.ratingCount,
    source: rec.isListing ? 'listing' : 'seed',
  });
}
