// Country names, localized by the platform (feature 011).
//
// The profile stores an ISO 3166-1 alpha-2 CODE; this turns it into a name in
// the traveler's language, at render time. `Intl.DisplayNames` is a browser
// standard — no dependency, no bundled data, and it stays current as countries
// are renamed.
//
// The alternative was ~500 keys in the locale files (249 countries × 2
// languages), which would have to be translated and maintained by hand, would go
// stale, and would swamp `check:brand`'s parity count for every future feature.
// It would also freeze a traveler's country in whichever language they happened
// to register in, since a stored NAME cannot be re-rendered.
import type { Language } from '@svtrip/shared';
import { COUNTRY_CODES } from '@svtrip/shared';

const cache = new Map<Language, Intl.DisplayNames>();

function displayNames(language: Language): Intl.DisplayNames | null {
  const hit = cache.get(language);
  if (hit) return hit;
  try {
    const made = new Intl.DisplayNames([language], { type: 'region' });
    cache.set(language, made);
    return made;
  } catch {
    // Ancient or exotic runtime without `Intl.DisplayNames`. Falling back to the
    // raw code keeps the picker usable — "SV" is worse than "El Salvador" but it
    // is not a broken screen.
    return null;
  }
}

/** The localized name for a country code, or the code itself if it cannot resolve. */
export function countryName(code: string, language: Language): string {
  return displayNames(language)?.of(code) || code;
}

/**
 * Every country, named and sorted for the language being displayed.
 *
 * Sorted with `localeCompare` in that same language, so a Spanish list reads
 * alphabetically to a Spanish speaker — sorting by ISO code would put Germany
 * ("DE") before Spain ("ES") in every language, which reads as random.
 */
export function countryOptions(language: Language): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, language) })).sort((a, b) =>
    a.name.localeCompare(b.name, language),
  );
}
