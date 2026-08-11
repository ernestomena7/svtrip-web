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
