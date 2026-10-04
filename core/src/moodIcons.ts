// Which icon a taxonomy entry shows.
//
// THREE LINKS, AND THE MIDDLE ONE IS THE ONE THAT GETS DROPPED
//
//   1. the icon a super admin assigned    (feature 014 — Material Symbols)
//   2. the built-in map below             (feature 001 — the brand line set)
//   3. a per-vocabulary default           (feature 014 — `person_check` for moods)
//
// Link 2 exists because of a consequence that is easy to miss. The instruction
// for feature 014 was to leave the existing moods' icon field EMPTY and fill
// them in by hand later. Empty resolves to the default — so without link 2, all
// eight built-in moods would render `person_check` on the redesign's signature
// grid the day it ships, replacing the heart, compass, utensils, music, waves,
// home, mountain and camera they show today. Eight identical generic tiles on
// the one screen the feature exists to improve.
//
// The chain reaches the same end state without that window: the field starts
// empty as asked, an admin fills it in whenever they like, and until then the
// existing mapping keeps the grid meaningful.
import type { Mood, TaxonomyEntry } from '@svtrip/shared';
import type { IconName } from './Icon';

/**
 * The brand line icon for a mood key, including one an admin invented.
 *
 * `MOOD_ICON` is keyed by the built-in `Mood` union, which stopped being the
 * whole story the moment moods became admin-managed (feature 010). Indexing it
 * with a raw string is both a type error AND a runtime `undefined` waiting to
 * reach `<Icon name={undefined}>`, so every picker goes through this instead.
 */
export function moodIcon(key: string): IconName {
  // `hasOwnProperty`, not a plain lookup. An admin-created mood keyed
  // `constructor` or `toString` would otherwise resolve to something off
  // Object.prototype — a function, not an icon name — and reach
  // `<Icon name={...}>` as a value the fallback was written to prevent.
  return Object.prototype.hasOwnProperty.call(MOOD_ICON, key)
    ? MOOD_ICON[key as Mood]
    : 'star';
}

export const MOOD_ICON: Record<Mood, IconName> = {
  'romantic-date': 'heart',
  'extreme-adventure': 'navigation',
  'local-food': 'utensils',
  nightlife: 'music',
  beach: 'waves',
  'colonial-town': 'home',
  hiking: 'mountain',
  culture: 'camera',
};

/**
 * The Material Symbols icon each vocabulary falls back to.
 *
 * Per vocabulary rather than one global default (FR-041): `person_check` is the
 * product owner's choice for moods and says something there. On a business type
 * it would say nothing at all.
 *
 * Name AND codepoint, because the renderer draws codepoints and this file ships
 * to the phone, which deliberately does not carry the 4,271-entry name map.
 * Three pairs is not a map — it is three constants, verified against the
 * official list when they were written.
 */
export const DEFAULT_TAXONOMY_ICON = {
  moods: { name: 'person_check', codepoint: 'f565' },
  'business-types': { name: 'storefront', codepoint: 'ea12' },
  services: { name: 'check_circle', codepoint: 'f0be' },
} as const;

/** What `resolveEntryIcon` decided to draw, and with which renderer. */
export type ResolvedIcon =
  | { kind: 'assigned'; codepoint: string }
  | { kind: 'builtIn'; name: IconName }
  | { kind: 'default'; codepoint: string };

/**
 * Resolve an entry to something drawable, never to nothing.
 *
 * Returns a DISCRIMINATED result rather than a single value because the two
 * icon sets render through different components — `Icon` draws inline SVG,
 * `TaxonomyIcon` draws a Material Symbols codepoint. Collapsing them into one
 * string would force every call site to guess which set a value came from.
 */
export function resolveEntryIcon(
  vocabulary: keyof typeof DEFAULT_TAXONOMY_ICON,
  key: string,
  entry?: Pick<TaxonomyEntry, 'icon' | 'iconCodepoint'>,
): ResolvedIcon {
  // 1. What an admin chose. Requires the codepoint the server derived — a name
  //    with no codepoint cannot be drawn here, and falling through is correct
  //    rather than rendering a box.
  if (entry?.icon && entry.iconCodepoint) {
    return { kind: 'assigned', codepoint: entry.iconCodepoint };
  }
  // 2. The built-in map. Moods only — the other two vocabularies never had one.
  if (vocabulary === 'moods' && key in MOOD_ICON) {
    return { kind: 'builtIn', name: MOOD_ICON[key as Mood] };
  }
  // 3. The default for this vocabulary.
  return { kind: 'default', codepoint: DEFAULT_TAXONOMY_ICON[vocabulary].codepoint };
}
