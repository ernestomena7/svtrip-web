// Publication readiness (feature 006, FR-008 to FR-013).
//
// Readiness is DERIVED from content, never stored. A stored status has to be
// rewritten on every content change to stay truthful, and a missed write
// silently publishes an incomplete profile — the same failure mode that made the
// review score a live subscription in feature 005.
//
// Two rules here are load-bearing and easy to get wrong:
//
// 1. The minimums are NOT retroactive (FR-009b). Measured 2026-08-05: 18 of the
//    19 catalog entries have zero photos. Applying a photo floor to everything
//    already published would unpublish 18 real businesses on deploy and leave
//    the AI Guide — which fails closed — with one place to recommend.
//
// 2. The language rule is a PARAMETER, not a hardcoded clause. US2 ships the
//    floor with photos and business type; US3 switches the language rule on once
//    a bilingual editor exists. Baking it in would make US2 enforce a rule it was
//    declared not to have, and would gate publication on an editor that does not
//    exist yet (Constitution IV — independent slices).
import { isLocalizedComplete, type LocalizedText } from './i18nContent.js';
import type { BusinessType } from './businessTypes.js';

/**
 * Stamped on every manager save from feature 006 onward. Its ABSENCE is what
 * marks an entry as predating the feature.
 *
 * An explicit stamp beats inferring legacy status from "has no bilingual fields
 * yet": that heuristic cannot express "legacy for photos too", and it
 * un-grandfathers an entry the moment one translation is written.
 */
export const CONTENT_VERSION = 6;

/** The fields a readiness decision depends on. */
export interface PublishableEntry {
  photos?: string[];
  gallery?: string[];
  businessType?: BusinessType;
  nameI18n?: LocalizedText;
  descriptionI18n?: LocalizedText;
  active?: boolean;
  contentVersion?: number;
}

export type MissingRequirement = 'photo' | 'businessType' | 'name' | 'description';

export interface PublicationOptions {
  /**
   * Defaults to **on** since US3 shipped the bilingual editor (T043a).
   *
   * It stayed off through US2 so that story could not accidentally enforce a
   * rule it was declared not to have, and so publication was never gated on an
   * editor that did not exist yet. It remains a parameter rather than becoming
   * a hardcoded clause because the tests need to pin both behaviors — and
   * because the day this has to be turned off again, it should be one argument
   * and not a rewrite.
   */
  requireBothLanguages?: boolean;
}

/** An entry authored before feature 006. Exempt from the minimums until saved. */
export function isLegacy(entry: PublishableEntry): boolean {
  return entry.contentVersion === undefined;
}

function photoCount(entry: PublishableEntry): number {
  return (entry.photos?.length ?? 0) + (entry.gallery?.length ?? 0);
}

/**
 * Everything still standing between this entry and being publishable.
 *
 * Returns the complete list, not the first failure: FR-010 requires telling a
 * manager what is missing, and revealing one item at a time turns finishing a
 * profile into a guessing game.
 */
export function missingRequirements(
  entry: PublishableEntry,
  { requireBothLanguages = true }: PublicationOptions = {},
): MissingRequirement[] {
  if (isLegacy(entry)) return [];

  const missing: MissingRequirement[] = [];
  if (photoCount(entry) < 1) missing.push('photo');
  if (!entry.businessType) missing.push('businessType');
  if (requireBothLanguages) {
    if (!isLocalizedComplete(entry.nameI18n)) missing.push('name');
    if (!isLocalizedComplete(entry.descriptionI18n)) missing.push('description');
  }
  return missing;
}

/** Whether the entry meets the content floor. Says nothing about the owner's intent. */
export function isPublishable(entry: PublishableEntry, options: PublicationOptions = {}): boolean {
  return missingRequirements(entry, options).length === 0;
}

/**
 * Whether travelers may see it.
 *
 * `active` is the owner's deliberate switch and `isPublishable` is whether the
 * content is presentable — different questions, and FR-008/FR-013 need both. An
 * unpublished-by-choice business and an unfinished one look identical to a
 * traveler and must not look identical to their manager.
 */
export function publicVisibility(
  entry: PublishableEntry,
  options: PublicationOptions = {},
): boolean {
  return entry.active !== false && isPublishable(entry, options);
}
