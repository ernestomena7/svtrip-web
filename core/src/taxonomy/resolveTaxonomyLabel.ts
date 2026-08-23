// The one place that decides what a taxonomy key is CALLED (feature 010).
//
// Same role `resolveLocalized` plays for business-authored content, and the same
// reason it exists: 13 render sites across both surfaces print these labels, and
// a surface that resolves its own would drift — a business type could read one
// way on a card and another on the profile.
//
// Two sources, in order:
//   1. An admin-created entry carries its own `labelI18n` and resolves through
//      `resolveLocalized`, exactly like a business's own name.
//   2. A built-in entry has no document at all (research R7), so it falls back
//      to the static translation key it has always used. Unchanged behaviour for
//      every one of the ~19 values that shipped before this feature.
import type { Language, TaxonomyEntry, TaxonomyVocabulary } from '@svtrip/shared';
import { resolveLocalized } from '@svtrip/shared';

type Translate = (key: string) => string;

/** The static i18n namespace each vocabulary has always used. */
const I18N_PREFIX: Record<TaxonomyVocabulary, string> = {
  'business-types': 'businessTypes',
  moods: 'moods',
  services: 'services.options',
};

export function resolveTaxonomyLabel(
  vocabulary: TaxonomyVocabulary,
  key: string,
  entry: TaxonomyEntry | undefined,
  t: Translate,
  language: Language,
): string {
  if (entry?.labelI18n) {
    const resolved = resolveLocalized(undefined, entry.labelI18n, language);
    if (resolved) return resolved;
  }
  return t(`${I18N_PREFIX[vocabulary]}.${key}`);
}

/** Convenience for the common case of resolving against a loaded entry list. */
export function taxonomyLabeller(
  vocabulary: TaxonomyVocabulary,
  entries: readonly TaxonomyEntry[],
  t: Translate,
  language: Language,
): (key: string) => string {
  const byKey = new Map(entries.map((e) => [e.key, e]));
  return (key) => resolveTaxonomyLabel(vocabulary, key, byKey.get(key), t, language);
}
