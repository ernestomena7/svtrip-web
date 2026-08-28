// Choosing which catalog entries to put in front of a traveler (feature 013).
//
// CHOOSING IS A SORT, NOT A PROMPT.
//
// "Which entries has this traveler not seen, ranked by rating, recency and
// engagement" is a comparator over data the product already holds. It costs zero
// tokens and adds zero model calls (FR-008, FR-020), and the allow-list sent to
// the model is REORDERED — never extended. If a field ever gets added to those
// entries to help the model rank, this feature has stopped being free and the
// contract test that pins the prompt's field set is what says so.
//
// Pure, so the BFF can run it: no React, no DOM, no I/O, no clock of its own.
import type { ExposureEntry, PlaceClaim } from './types.js';
import { scoreSignalFor } from './score.js';

/** What the ranking needs to know about one candidate. */
export interface RankableEntry {
  id: string;
  /** Traveler review average and count, when the entry has any. */
  ratingAvg?: number;
  ratingCount?: number;
  /** Editorial rating on curated entries; never a review average. */
  rating?: number;
  source?: 'seed' | 'listing';
  /** When it entered the catalog. Absent on seed entries, which predate it. */
  createdAt?: number;
  /** Recent engagement across all travelers. */
  engagementCount?: number;
  /** A commercial arrangement. May inform ORDER; never becomes a claim. */
  boosted?: boolean;
}

export interface RankingContext {
  /** What this traveler has already been shown. */
  seen: readonly ExposureEntry[];
  /** Now, passed in so the comparator stays pure and testable. */
  now: number;
}

/**
 * How recent an entry must be to be called "new".
 *
 * 60 days: long enough that a business added last month is still worth pointing
 * out, short enough that "new" keeps meaning something. Nothing depends on the
 * exact number — it is a product judgment, and the predicate is tested against
 * both sides of it.
 */
export const NEW_WINDOW_MS = 60 * 24 * 60 * 60 * 1000;

/** How much recent engagement makes an entry "popular". */
export const POPULAR_THRESHOLD = 10;

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

/**
 * What can honestly be said about this entry, or nothing.
 *
 * `undefined` is a first-class answer, not a failure. Measured at the time this
 * was written: 3 of 36 catalog entries have a review average and 0 are boosted,
 * so most entries qualify for no claim — and that is fine, because "you haven't
 * tried this" is true of everything unseen and needs no supporting evidence.
 *
 * Ordered by strength: a genuinely reviewed entry is a better thing to say than
 * a recently added one.
 */
export function claimFor(entry: RankableEntry, ctx: RankingContext): PlaceClaim | undefined {
  // Routed through `scoreSignalFor` rather than reading `ratingAvg` directly, so
  // the guide can never describe an entry as well rated while that entry's own
  // card shows no rating (feature 005, SC-009). Note that an EDITORIAL rating
  // returns `kind: 'editorial'`, not `'average'` — so a curated entry with a
  // hand-assigned score still cannot be called well rated. Only travelers can
  // make that true.
  if (scoreSignalFor(entry).kind === 'average') return 'well-rated';

  if (typeof entry.engagementCount === 'number' && entry.engagementCount >= POPULAR_THRESHOLD) {
    return 'popular';
  }

  if (typeof entry.createdAt === 'number' && ctx.now - entry.createdAt <= NEW_WINDOW_MS) {
    return 'new';
  }

  // Deliberately unreachable from `boosted`. A commercial arrangement is not a
  // quality signal, and asserting it as one would be the product lying in a
  // complete sentence (FR-018).
  return undefined;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

const CLAIM_STRENGTH: Record<PlaceClaim, number> = {
  'well-rated': 3,
  popular: 2,
  new: 1,
};

interface SeenState {
  seen: boolean;
  takenUp: boolean;
}

function seenStateFor(id: string, seen: readonly ExposureEntry[]): SeenState {
  const hit = seen.find((e) => e.catalogId === id);
  return { seen: Boolean(hit), takenUp: Boolean(hit?.takenUpAt) };
}

/**
 * Order candidates for one traveler.
 *
 * **This never filters.** Every entry passed in comes back out — relevance was
 * already decided by whoever assembled the list, and freshness is a preference
 * applied WITHIN the relevant set (FR-009). A guide that withholds the only
 * correct answer because it said it once has stopped answering the question,
 * which is why `rankForTraveler` returns the same length it was given and a test
 * asserts it.
 *
 * Order:
 *   1. unseen before seen
 *   2. among seen: ignored before taken-up — something shown and passed over is
 *      a weaker suggestion than something the traveler actually liked
 *   3. claim strength
 *   4. boosted, as the last tiebreak only
 *   5. id, so the result is deterministic
 */
export function rankForTraveler<T extends RankableEntry>(
  entries: readonly T[],
  ctx: RankingContext,
): T[] {
  return [...entries].sort((a, b) => {
    const sa = seenStateFor(a.id, ctx.seen);
    const sb = seenStateFor(b.id, ctx.seen);

    if (sa.seen !== sb.seen) return sa.seen ? 1 : -1;
    if (sa.seen && sa.takenUp !== sb.takenUp) return sa.takenUp ? 1 : -1;

    // An entry with no claim scores 0 — below every claim, which is right: it
    // has nothing verifiable going for it beyond being unseen.
    const strength = (e: RankableEntry) => {
      const claim = claimFor(e, ctx);
      return claim ? CLAIM_STRENGTH[claim] : 0;
    };
    const strengthA = strength(a);
    const strengthB = strength(b);
    if (strengthA !== strengthB) return strengthB - strengthA;

    // Last, and only as a tiebreak between otherwise equal candidates. Ordering
    // may consider a boost; a CLAIM may not (FR-018).
    if (Boolean(a.boosted) !== Boolean(b.boosted)) return a.boosted ? -1 : 1;

    return a.id.localeCompare(b.id);
  });
}

/**
 * The best unseen candidate to introduce, or nothing.
 *
 * Returns `undefined` when every candidate has been seen. **Nothing is
 * manufactured** (FR-014): a reply with no introduction is a correct reply, and
 * there is no fallback that picks a seen entry and calls it new.
 */
export function pickIntroduction<T extends RankableEntry>(
  entries: readonly T[],
  ctx: RankingContext,
  exclude: readonly string[] = [],
): T | undefined {
  const skip = new Set(exclude);
  const unseen = entries.filter(
    (e) => !skip.has(e.id) && !seenStateFor(e.id, ctx.seen).seen,
  );
  if (!unseen.length) return undefined;
  return rankForTraveler(unseen, ctx)[0];
}
