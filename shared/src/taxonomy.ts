// Admin-managed vocabularies (feature 010).
//
// Business types, moods and additional services were fixed constants in
// `businessTypes.ts` and `types.ts` — changing one meant an engineer, a code
// change and a release. This adds a Firestore-backed layer so a super admin can
// add, relabel and deactivate entries live.
//
// The layer is ADDITIVE and that is load-bearing: `BUSINESS_TYPES`, `MOODS`,
// `UNIVERSAL_SERVICES` and `SERVICES_BY_TYPE` are untouched and remain the
// baseline. A built-in entry has NO document until a super admin first touches
// it (research R7), so its absence means "active, labelled by its existing
// translation key" — the same "absent means the pre-feature default" idiom
// `contentVersion` already uses for publication rules.
//
// Migrating the ~19 existing values into Firestore instead would have meant
// rewriting all 13 label render sites at once and risking working, tested
// rendering for values nobody asked to change.
import type { LocalizedText } from './i18nContent.js';

/** The three vocabularies, in the URL-safe form the admin API takes. */
export const TAXONOMY_VOCABULARIES = ['business-types', 'moods', 'services'] as const;
export type TaxonomyVocabulary = (typeof TAXONOMY_VOCABULARIES)[number];

/** Firestore collection backing each vocabulary. */
export const TAXONOMY_COLLECTION: Record<TaxonomyVocabulary, string> = {
  'business-types': 'businessTypes',
  moods: 'moods',
  services: 'additionalServices',
};

/**
 * Which business types an additional service applies to (FR-007).
 *
 * Only meaningful for admin-CREATED services. A built-in one keeps its scope in
 * `SERVICES_BY_TYPE`/`UNIVERSAL_SERVICES`, unchanged.
 */
export type ServiceScope =
  | { universal: true }
  | { universal: false; businessTypes: string[] };

/**
 * One entry in any of the three vocabularies.
 *
 * `key` is the document id and is IMMUTABLE after creation: listings store it
 * verbatim in `businessType`/`moods`/`services`, so renaming one would orphan
 * every record already pointing at it. Only the label (and, for services, the
 * scope) may be edited.
 */
export interface TaxonomyEntry {
  key: string;
  /**
   * Absent for a built-in entry — its label still resolves through the existing
   * `businessTypes.*` / `moods.* `/ `services.options.*` translation keys.
   * Required, and complete in both languages, for an admin-created one (FR-008).
   */
  labelI18n?: LocalizedText;
  /** Deactivation is reversible (FR-006a) — this is a switch, not an archive. */
  active: boolean;
  /** Set only on services created through the admin interface. */
  scope?: ServiceScope;
  /**
   * A Material Symbols icon name a super admin chose (feature 014, US4).
   *
   * Optional, so the eleven built-in business types, the eight built-in moods
   * and every entry already created stay valid with no migration and no
   * backfill. Absent means "fall back" — see `moodIcon()` for the chain.
   *
   * The NAME is the source of truth: human-readable, admin-editable, and stable
   * across a font upgrade that renumbers glyphs.
   */
  icon?: string;
  /**
   * The glyph for `icon`, derived and stored by the server.
   *
   * Denormalised on purpose, and the reason is a size decision rather than a
   * performance one. Icons render by CODEPOINT rather than by ligature, because
   * a ligature paints the literal string `person_check` into the UI the moment
   * the font is unavailable. Resolving a name to a codepoint needs the official
   * 4,271-entry map — 94 KB — and the mobile app is installed, so that would be
   * 94 KB of APK on top of the 362 KB font.
   *
   * Storing the codepoint moves that map to where it is already needed: the
   * server, which validates the name anyway, and the admin form, which previews
   * it. The phone renders what it was given and carries neither.
   *
   * Never written by a client. Never authoritative — if it and `icon` ever
   * disagree, `icon` wins and this is re-derived.
   */
  iconCodepoint?: string;
  /** Who last created/edited/deactivated/reactivated this, from the verified token. */
  lastChangedByUid: string;
  lastChangedAt: number;
  createdAt: number;
}

/** True when a scope is well-formed enough to store (FR-007). */
export function isValidServiceScope(scope: ServiceScope | undefined): scope is ServiceScope {
  if (!scope) return false;
  if (scope.universal === true) return true;
  return Array.isArray(scope.businessTypes) && scope.businessTypes.length > 0;
}

/** Whether this service applies to a business of the given type. */
export function serviceAppliesTo(scope: ServiceScope | undefined, businessType: string): boolean {
  // No scope means a built-in service, whose applicability is decided by
  // `servicesFor()` in businessTypes.ts, not here.
  if (!scope) return false;
  return scope.universal === true || scope.businessTypes.includes(businessType);
}

/**
 * Merge built-in keys with admin-managed entries.
 *
 * One function, used by every picker on both surfaces, so a business type can
 * never be offered on one screen and missing on another. Returns keys in a
 * stable order: built-ins first (their existing order is deliberate), then
 * admin-created ones by creation time.
 */
export function mergeTaxonomyKeys(
  builtIn: readonly string[],
  entries: readonly TaxonomyEntry[],
): string[] {
  const overrides = new Map(entries.map((e) => [e.key, e]));
  const kept = builtIn.filter((key) => overrides.get(key)?.active !== false);
  const added = entries
    .filter((e) => e.active && !builtIn.includes(e.key))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((e) => e.key);
  return [...kept, ...added];
}
