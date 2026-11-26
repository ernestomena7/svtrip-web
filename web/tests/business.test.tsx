// Business surfaces (feature 007, T111).
//
// THE PUBLICATION RULES ARE THE POINT OF THIS FILE. Break them and the catalog
// empties on deploy, taking the AI Guide with it — the guide fails closed, so a
// business that stops being publicly visible stops being recommendable at all.
//
// Three properties, each of which has a plausible-sounding "cleanup" that would
// destroy it:
//
//   1. Readiness is DERIVED from content, never stored.
//   2. The minimums are NOT retroactive — 18 of 19 live entries have no photos
//      and must stay published until their first save.
//   3. The floor guards regression ONLY — an entry already below the bar stays
//      editable, or its manager cannot fix the very thing that is missing.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  CONTENT_VERSION,
  isLegacy,
  isPublishable,
  publicVisibility,
  type PublishableEntry,
} from '@svtrip/shared';
import '@svtrip/core/i18n';

vi.mock('@svtrip/core/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'owner' }, profile: null, loading: false }),
}));

const { PublicationChecklist } = await import('../src/business/PublicationChecklist');

afterEach(cleanup);

/** An entry saved under feature 006 — subject to the full floor. */
const modern = (over: Partial<PublishableEntry> = {}): PublishableEntry => ({
  photos: ['p.jpg'],
  gallery: [],
  businessType: 'restaurant-cafe',
  active: true,
  nameI18n: { es: 'Nombre', en: 'Name' },
  descriptionI18n: { es: 'Descripción', en: 'Description' },
  contentVersion: CONTENT_VERSION,
  ...over,
});

/** A pre-006 entry: no `contentVersion` at all. */
const legacy = (over: Partial<PublishableEntry> = {}): PublishableEntry => {
  const entry = modern({ photos: [], businessType: undefined, ...over });
  delete (entry as { contentVersion?: number }).contentVersion;
  return entry;
};

describe('publication rules', () => {
  it('derives readiness from content rather than a stored flag', () => {
    expect(isPublishable(modern())).toBe(true);
    // Remove the photo and readiness changes immediately — nothing was stored.
    expect(isPublishable(modern({ photos: [], gallery: [] }))).toBe(false);
  });

  it('keeps pre-006 entries publicly visible despite having no photos', () => {
    // The load-bearing one. 18 of the 19 catalog entries are exactly this shape;
    // enforcing the floor on them would unpublish the whole catalog on deploy.
    const entry = legacy();
    expect(isLegacy(entry)).toBe(true);
    expect(publicVisibility(entry)).toBe(true);
  });

  it('applies the floor once an entry has been saved under the current version', () => {
    // Same content as the legacy entry above — no photo, no type — but stamped.
    // Built with `modern` rather than `legacy` because `legacy` strips the stamp
    // after applying overrides, which is the whole distinction being tested.
    const saved = modern({ photos: [], gallery: [], businessType: undefined });
    expect(isLegacy(saved)).toBe(false);
    expect(isPublishable(saved)).toBe(false);
  });

  // FR-011 NOTE (feature 025, research R16): the first assertion was `nameI18n: { es: 'Solo español', en: '' }`
  // → NOT publishable. One language is now enough; the missing one is a recommendation. The case still
  // pins "incomplete is never ready" — with a name in NO language, which is what incomplete means now.
  it('never reports an incomplete entry as ready', () => {
    expect(isPublishable(modern({ nameI18n: { es: '', en: '' } }))).toBe(false);
    expect(isPublishable(modern({ nameI18n: { es: 'Solo español', en: '' } }))).toBe(true);
    expect(isPublishable(modern({ businessType: undefined }))).toBe(false);
  });
});

describe('PublicationChecklist', () => {
  it('lists what is still missing rather than only saying "not ready"', () => {
    render(<PublicationChecklist entry={modern({ photos: [], gallery: [] })} />);
    // A checklist that says "incomplete" without naming the gap leaves the owner
    // guessing at the one screen that exists to close it.
    expect(screen.getByText(/foto|photo/i)).toBeDefined();
  });

  it('confirms readiness when everything is in place', () => {
    render(<PublicationChecklist entry={modern()} />);
    expect(screen.getByText(/cumple todo|meets everything/i)).toBeDefined();
  });

  it('tells a legacy entry that the minimums arrive on its next save', () => {
    render(<PublicationChecklist entry={legacy()} />);
    expect(screen.getByText(/anterior a los mínimos|predates the current minimums/i)).toBeDefined();
  });
});

describe('PublicationChecklist — a missing translation is a recommendation (025 FR-017a)', () => {
  it('a one-language entry is READY, and the English description is recommended, not missing', () => {
    render(<PublicationChecklist entry={modern({ descriptionI18n: { es: 'Descripción', en: '' } })} />);
    expect(screen.getByText(/cumple todo|meets everything/i)).toBeDefined();
    expect(screen.getByTestId('publication-recommended').textContent).toMatch(/descripción en inglés|description in English/i);
  });

  it('both languages: nothing recommended (the allow beside the deny)', () => {
    render(<PublicationChecklist entry={modern()} />);
    expect(screen.queryByTestId('publication-recommended')).toBeNull();
  });
});
