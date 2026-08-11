// The one place that decides which language a piece of business-authored
// content renders in (feature 006, FR-014 to FR-017).
//
// Every surface — cards, profile, promotions, the AI Guide's catalog allow-list
// — resolves through here. A surface that implements its own fallback is the
// same class of defect as a card formatting its own rating (see lib/score.ts and
// SC-009 in feature 005): two readers drift, and a traveler sees one language on
// the card and another on the profile.
//
// Bilingual fields are ADDITIVE. `nameI18n` sits beside `name`; it never
// replaces it. That is what lets content written before this feature stay
// published instead of rendering blank (FR-015a) — on 2026-08-04 that was every
// business, promotion and event in the product.
import type { Language } from './types.js';

/** A string a traveler can read, in both product languages. */
export interface LocalizedText {
  es: string;
  en: string;
}

const OTHER: Record<Language, Language> = { es: 'en', en: 'es' };

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Resolve a business-authored string for display.
 *
 * Order: the active language, then the other language, then the legacy flat
 * field. Falling back to the other language before the legacy field matters for
 * a record that has been half-migrated — showing the English name to a Spanish
 * traveler is worse than nothing only if you ignore that the alternative is an
 * empty card.
 */
export function resolveLocalized(
  legacy: string | undefined,
  localized: LocalizedText | undefined,
  language: Language,
): string {
  return (
    nonEmpty(localized?.[language]) ??
    nonEmpty(localized?.[OTHER[language]]) ??
    nonEmpty(legacy) ??
    ''
  );
}

/**
 * Whether a localized value is complete enough to publish (FR-015).
 *
 * Whitespace is not a translation. Without the trim, a space bar keeps the save
 * button enabled and ships an empty field to travelers.
 */
export function isLocalizedComplete(value: LocalizedText | undefined): boolean {
  return Boolean(nonEmpty(value?.es) && nonEmpty(value?.en));
}

/** True when a value carries at least one language — used to detect partial writes. */
export function hasAnyLanguage(value: LocalizedText | undefined): boolean {
  return Boolean(nonEmpty(value?.es) || nonEmpty(value?.en));
}

/** Build a LocalizedText, trimming both sides. Never produces `undefined` keys. */
export function localizedText(es: string, en: string): LocalizedText {
  return { es: es.trim(), en: en.trim() };
}
