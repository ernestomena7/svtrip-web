// Free-text search over the catalog, for Discover on mobile (feature 014, US2).
//
// THE ONE THING TO GET RIGHT
//
// The catalog stores `moods` and `categories` as ENGLISH KEYS — `beach`,
// `volcano`, `nightlife`, `colonial-town` — while `keywords` holds free Spanish
// text (`playa tunco`, `volcan`, `el tunco`). Matching the stored key would mean
// that in a Spanish-primary product, typing "beach" finds beaches and typing
// "playa" does not, except where a keyword happens to cover it.
//
// So tags are matched on their RESOLVED LABEL in the traveler's language
// (FR-062). `moods.beach` already resolves to "Playa"; search goes through that
// resolution rather than around it. The caller supplies the resolver, which is
// what keeps this module free of i18next and therefore runnable by the server.
//
// The long description is deliberately NOT searched (FR-009): it produces
// matches a traveler cannot explain, which reads as randomness rather than
// search.

/**
 * Lowercase and strip diacritics.
 *
 * Same approach as `clarification.ts`, deliberately: one product, one idea of
 * what "the same word" means. `volcan` finds `volcán`, `cafe` finds `café`.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** The parts of a catalog entry search looks at. Deliberately not `Place`. */
export interface SearchableEntry {
  name: string;
  categories?: readonly string[];
  keywords?: readonly string[];
  moods?: readonly string[];
}

/**
 * Turns a stored key into the label a traveler reads.
 *
 * Supplied by the caller — on the client that is i18next, on the server it is
 * whatever the caller has. Passing it in is what lets this module stay pure and
 * stay in `shared/`.
 */
export type LabelResolver = (kind: 'mood' | 'category', key: string) => string;

/**
 * Every string a query is matched against, already normalized.
 *
 * Exported so a test can assert the SET of searched fields directly, rather than
 * inferring it from which queries happen to match — which is how "we also search
 * the description now" slips in unnoticed.
 */
export function searchableText(
  entry: SearchableEntry,
  resolveLabel: LabelResolver,
  displayName?: string,
): string[] {
  const parts: string[] = [
    // The name as DISPLAYED, so a business with `nameI18n` is findable by the
    // name actually on screen (FR-063). Falls back to the raw name.
    displayName ?? entry.name,
    // The raw name too: a traveler who knows a place by its other-language name
    // should still find it, and it costs nothing.
    entry.name,
    // Free text, already in the traveler's language in practice.
    ...(entry.keywords ?? []),
    // Tags, resolved. NEVER the raw key — see the note at the top.
    ...(entry.moods ?? []).map((k) => resolveLabel('mood', k)),
    ...(entry.categories ?? []).map((k) => resolveLabel('category', k)),
  ];
  return parts.filter(Boolean).map(normalize);
}

/**
 * Whether an entry matches a free-text query.
 *
 * Substring rather than word-boundary matching, unlike `clarification.ts`, and
 * the difference is intentional: that module decides whether to spend a model
 * call, so a false positive is expensive. This one narrows a visible list as
 * someone types, where matching "playa" against "playas" mid-keystroke is the
 * whole point. An empty query matches everything.
 */
export function matchesQuery(
  entry: SearchableEntry,
  query: string,
  resolveLabel: LabelResolver,
  displayName?: string,
): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return searchableText(entry, resolveLabel, displayName).some((text) => text.includes(q));
}
