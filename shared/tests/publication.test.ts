// T008 — publication readiness.
//
// The single most consequential test in this file is "a legacy entry with zero
// photos is publishable". On 2026-08-05, 18 of the 19 live catalog entries were
// exactly that. If it fails, they vanish from Discover, the wheel and the AI
// Guide's allow-list — and the guide fails closed, so it would answer almost
// nothing.
import { describe, expect, it } from 'vitest';
import {
  CONTENT_VERSION,
  isLegacy,
  isPublishable,
  missingRequirements,
  publicVisibility,
  travelerVisible,
  offerVisible,
  type PublishableEntry,
} from '../src/publication.js';

/** An entry saved under feature 006 — subject to the full floor. */
function modern(over: Partial<PublishableEntry> = {}): PublishableEntry {
  return {
    contentVersion: CONTENT_VERSION,
    photos: ['https://example.invalid/1.jpg'],
    businessType: 'restaurant-cafe',
    nameI18n: { es: 'Comedor', en: 'Diner' },
    descriptionI18n: { es: 'Rico', en: 'Tasty' },
    active: true,
    ...over,
  };
}

describe('legacy entries are exempt from the minimums (FR-009b)', () => {
  it('a legacy entry with zero photos is publishable', () => {
    // 18 of 19 live businesses. Breaking this empties the catalog.
    const legacy: PublishableEntry = { photos: [], businessType: 'attraction', active: true };
    expect(isLegacy(legacy)).toBe(true);
    expect(isPublishable(legacy)).toBe(true);
    expect(publicVisibility(legacy)).toBe(true);
  });

  it('a legacy entry with no business type and no photos is still publishable', () => {
    expect(isPublishable({ active: true })).toBe(true);
  });

  it('a legacy entry reports nothing missing, so its manager is not nagged', () => {
    expect(missingRequirements({ photos: [] })).toEqual([]);
  });

  it('stops being legacy once it carries a content version', () => {
    const saved: PublishableEntry = { contentVersion: CONTENT_VERSION, photos: [], active: true };
    expect(isLegacy(saved)).toBe(false);
    expect(isPublishable(saved)).toBe(false);
  });
});

describe('the photo and business-type floor (US2)', () => {
  it('accepts a complete modern entry', () => {
    expect(isPublishable(modern())).toBe(true);
  });

  it('counts gallery images toward the photo minimum', () => {
    expect(isPublishable(modern({ photos: [], gallery: ['https://example.invalid/g.jpg'] }))).toBe(
      true,
    );
  });

  it('refuses an entry with no photo at all', () => {
    expect(missingRequirements(modern({ photos: [], gallery: [] }))).toEqual(['photo']);
  });

  it('refuses an entry with no business type', () => {
    expect(missingRequirements(modern({ businessType: undefined }))).toEqual(['businessType']);
  });

  it('names EVERY missing item, not just the first (FR-010)', () => {
    const bare = { contentVersion: CONTENT_VERSION, photos: [], active: true };
    expect(missingRequirements(bare)).toEqual(['photo', 'businessType', 'name', 'description']);
  });
});

describe('the language rule (on by default since US3 — T043a)', () => {
  const halfTranslated = modern({ nameI18n: { es: 'Comedor', en: '' } });

  it('refuses a half-translated entry by default', () => {
    expect(missingRequirements(halfTranslated)).toEqual(['name']);
  });

  it('can still be turned off explicitly', () => {
    // The parameter survives so the US2 behavior stays expressible and pinned:
    // the day this has to be disabled it should be one argument, not a rewrite.
    expect(isPublishable(halfTranslated, { requireBothLanguages: false })).toBe(true);
  });

  it('still exempts legacy entries', () => {
    // Grandfathering survives US3 — otherwise turning the rule on unpublishes
    // every business that has not been translated yet (FR-015a).
    expect(isPublishable({ photos: [], active: true })).toBe(true);
  });

  it('names both text fields when both are half-written', () => {
    const entry = modern({
      nameI18n: { es: 'Comedor', en: '' },
      descriptionI18n: { es: '', en: 'Tasty' },
    });
    expect(missingRequirements(entry)).toEqual(['name', 'description']);
  });
});

describe('publicVisibility separates "unfinished" from "unpublished by choice"', () => {
  it('hides a complete entry the owner deliberately unpublished (FR-013)', () => {
    expect(publicVisibility(modern({ active: false }))).toBe(false);
  });

  it('hides an unfinished entry even when active', () => {
    expect(publicVisibility(modern({ photos: [], gallery: [] }))).toBe(false);
  });

  it('treats a missing `active` as published, matching existing catalog data', () => {
    expect(publicVisibility(modern({ active: undefined }))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Feature 018 — subscription coverage as a SECOND, independent reason to hide.
// ---------------------------------------------------------------------------

describe('travelerVisible: coverage is cumulative with the content floor, never a substitute', () => {
  // The single most consequential line in feature 018 is `covered !== false`
  // rather than `covered === true`. Measured 2026-10-02: all 33 live listings
  // have NO `covered` field, so the strict form would make every one of them
  // vanish the moment this ships — the same failure the legacy-photo case above
  // exists to prevent, arriving through a different field.
  it('shows a listing that has no `covered` field at all', () => {
    expect(travelerVisible(modern())).toBe(true);
  });

  it('shows a listing explicitly covered', () => {
    expect(travelerVisible(modern({ covered: true }))).toBe(true);
  });

  it('hides a listing whose subscription does not cover it', () => {
    expect(travelerVisible(modern({ covered: false }))).toBe(false);
  });

  it('hides a covered listing that is still below the content floor', () => {
    // FR-034: subscription state is a SECOND reason, not a replacement. A
    // merchant who pays and is still unfinished stays hidden — and FR-024
    // requires being told both reasons, which is why neither one may win.
    expect(travelerVisible(modern({ covered: true, photos: [], gallery: [] }))).toBe(false);
  });

  it('hides a covered listing the owner switched off', () => {
    expect(travelerVisible(modern({ covered: true, active: false }))).toBe(false);
  });

  it('hides an uncovered LEGACY entry, which the content floor would have exempted', () => {
    // The grandfathering of feature 006 covers CONTENT, not payment. An entry
    // predating 006 is exempt from the photo floor and is NOT exempt from
    // needing a subscription behind it.
    expect(travelerVisible({ covered: false })).toBe(false);
    expect(publicVisibility({})).toBe(true); // ...which the floor alone allows
  });
});

// ---------------------------------------------------------------------------
// Feature 018 — Ofertas (US3, FR-016/FR-028; US4 scenario 2)
// ---------------------------------------------------------------------------

describe('offerVisible: Ofertas is the ONE surface with no visibility filter today', () => {
  // `fetchActiveDeals` reads `deals` and filters on the date window alone. It
  // never consults the owning listing, so a suspended place's promotion
  // survives TODAY by construction — the only one of FR-016's four insertion
  // points where the work is a join rather than one more conjunct.

  const live = { covered: true, offersEligible: true, contentVersion: CONTENT_VERSION,
                 photos: ['p.jpg'], businessType: 'restaurant-cafe' as const,
                 nameI18n: { es: 'A', en: 'A' }, descriptionI18n: { es: 'B', en: 'B' } };

  it('shows a promotion whose place is covered and whose owner may publish', () => {
    expect(offerVisible({}, live)).toBe(true);
  });

  it('HIDES a promotion whose place is not covered', () => {
    // The whole of US3 for this surface: a suspended place's promotion leaves
    // Ofertas with the place.
    expect(offerVisible({}, { ...live, covered: false })).toBe(false);
  });

  it('hides a promotion whose owner may no longer publish to Ofertas', () => {
    // US4 scenario 2: a Premium account that drops to Básico loses Ofertas and
    // keeps the promotion on its own profile. Driven by the listing flag rather
    // than by rewriting the merchant's own choice, so an upgrade restores it
    // without them having to re-mark anything.
    expect(offerVisible({}, { ...live, offersEligible: false })).toBe(false);
  });

  it('hides a promotion the merchant chose to keep off Ofertas', () => {
    // Premium can mark a promotion profile-only (US2 scenario 3), so eligible
    // is not the same as published.
    expect(offerVisible({ inOfertas: false }, live)).toBe(false);
  });

  it('shows a promotion with NO `inOfertas` field at all', () => {
    // `!== false`, the same shape as `covered`, and for the same reason: a
    // promotion written before this feature has no such field and must not
    // vanish from Ofertas on deploy.
    expect(offerVisible({ inOfertas: undefined }, live)).toBe(true);
  });

  it('shows a promotion whose listing has NEITHER flag — written before 018', () => {
    expect(offerVisible({}, { ...live, covered: undefined, offersEligible: undefined })).toBe(true);
  });

  it('hides a promotion whose place is below the content floor', () => {
    // Cumulative with everything else (FR-034). A covered, eligible promotion
    // on an unfinished place still does not belong in front of travelers.
    expect(offerVisible({}, { ...live, photos: [], gallery: [] })).toBe(false);
  });

  it('hides a promotion with no owning listing to check', () => {
    // Fails CLOSED. A deal whose listing cannot be resolved is a deal the
    // product cannot vouch for.
    expect(offerVisible({}, undefined)).toBe(false);
  });
});
