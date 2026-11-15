// How Discover orders places — moved verbatim from core/src/repos/discoverRepo.ts at feature 024 so
// the MCP connector (server) orders search results EXACTLY as the app does (contracts/mcp-tools.md:
// "the app's Discover ordering for the same filter"). One comparator, two readers: a copy per surface
// is how desktop and mobile Discover drifted apart at feature 014.
import type { Place } from './types.js';

/**
 * Best-rated first, by what travelers actually said.
 *
 * `rating` is the EDITORIAL score — `types.ts` says so beside the field, and
 * "never render it in an average's slot". Ordering by it did something close
 * to that: a curated 5 outranked a place with thirty real reviews averaging
 * 4.8, which is the opposite of what "best rated" tells a traveler.
 *
 * Both fields are optional, so the old expression could also be
 * `undefined - undefined` — NaN, which makes the sort order undefined rather
 * than merely wrong.
 */
export function byRatingDesc(a: Place, b: Place): number {
  const score = (p: Place) => p.ratingAvg ?? p.rating ?? 0;
  return score(b) - score(a);
}

/**
 * Ranking comparator (T094, FR-027): sponsored (boosted) providers surface
 * first, then by rating. Boost only reorders — it never injects places the
 * filter didn't already select.
 */
export function byBoostThenRating(a: Place, b: Place): number {
  if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
  return byRatingDesc(a, b);
}
