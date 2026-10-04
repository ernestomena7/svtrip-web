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
  /**
   * Whether a live subscription covers this place (feature 018, FR-016).
   *
   * **Denormalized onto the listing, and deliberately opaque.** `listings` is
   * `allow read: if signedIn()`, so every signed-in traveler can read every
   * field — a `planCode` or a status enum here would break FR-015 no matter
   * what any screen renders. A boolean says "not currently visible", which a
   * traveler can already see, and says nothing about plans, prices or payment.
   *
   * Written only by the BFF's subscription service (FR-026/FR-027), which is
   * the whole safety of denormalizing it.
   */
  covered?: boolean;
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

/**
 * Whether travelers may see this entry, once feature 018's subscription layer
 * is taken into account.
 *
 * `publicVisibility` answers "is the content presentable and did the owner
 * switch it on". This adds a third, INDEPENDENT question: is there a live
 * subscription behind it (FR-016)?
 *
 * **The three reasons are cumulative, never substituted** (FR-034). A merchant
 * who pays and is still unfinished stays hidden, and FR-024 requires being told
 * every reason that applies — a merchant who pays and stays invisible will
 * otherwise read it as the payment having failed and contact support about the
 * wrong thing.
 *
 * **`covered !== false`, NOT `covered === true`.** This is the single most
 * consequential line in feature 018. Measured 2026-10-02: all 33 live listings
 * carry no `covered` field at all, so the strict form would hide the entire
 * catalog on deploy — taking the AI Guide, which fails closed, with it. It is
 * the same shape as `isLegacy()`'s `contentVersion === undefined` above, and it
 * exists for the same reason: a field this product adds must not retroactively
 * condemn every record written before it.
 */
export function travelerVisible(
  entry: PublishableEntry,
  options: PublicationOptions = {},
): boolean {
  return entry.covered !== false && publicVisibility(entry, options);
}

/**
 * Whether a promotion belongs on the Ofertas surface (feature 018, FR-016).
 *
 * **Ofertas is the one discovery surface with no visibility filter at all
 * today.** `fetchActiveDeals` reads `deals` and filters on the date window
 * alone; it never consults the owning listing. So a suspended place's promotion
 * survives by construction, and this is the only one of FR-016's four insertion
 * points where the work is a JOIN rather than one more conjunct.
 *
 * Three independent questions, and collapsing any two of them loses something:
 *
 *  1. **Is the place visible at all** (`travelerVisible`) — content floor,
 *     the owner's switch, and subscription coverage.
 *  2. **May this owner publish to Ofertas** (`offersEligible`) — a Premium
 *     entitlement, denormalized onto the listing by the BFF because a client
 *     cannot read another merchant's plan. This is what makes US4 scenario 2
 *     work: a Premium account dropping to Básico loses Ofertas and KEEPS the
 *     promotion on its own profile. Driven by this flag rather than by
 *     rewriting the merchant's own choice, so an upgrade restores it without
 *     them having to re-mark anything.
 *  3. **Did the merchant choose to publish it** (`inOfertas`) — Premium may
 *     keep a promotion profile-only (US2 scenario 3), so eligible is not the
 *     same as published.
 *
 * `!== false` on both stored flags, the same shape as `covered` and for the
 * same reason: records written before this feature carry neither, and must not
 * vanish on deploy.
 *
 * **Fails CLOSED on a missing listing.** A deal whose place cannot be resolved
 * is a deal the product cannot vouch for, and Ofertas is a surface travelers
 * are invited to act on.
 */
export function offerVisible(
  deal: { inOfertas?: boolean },
  listing: (PublishableEntry & { offersEligible?: boolean }) | undefined,
  options: PublicationOptions = {},
): boolean {
  if (!listing) return false;
  if (deal.inOfertas === false) return false;
  if (listing.offersEligible === false) return false;
  return travelerVisible(listing, options);
}
