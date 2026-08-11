// T006 — the content resolver is the single point every surface trusts (R1).
// If these cases drift, a card and a profile start showing different languages
// for the same business.
import { describe, expect, it } from 'vitest';
import {
  hasAnyLanguage,
  isLocalizedComplete,
  localizedText,
  resolveLocalized,
} from '../src/i18nContent.js';

describe('resolveLocalized', () => {
  const both = { es: 'Playa El Tunco', en: 'El Tunco Beach' };

  it('returns the active language when both exist', () => {
    expect(resolveLocalized('legacy', both, 'es')).toBe('Playa El Tunco');
    expect(resolveLocalized('legacy', both, 'en')).toBe('El Tunco Beach');
  });

  it('falls back to the other language rather than rendering empty', () => {
    // Half-migrated record: showing the other language beats an empty card.
    expect(resolveLocalized(undefined, { es: 'Suchitoto', en: '' }, 'en')).toBe('Suchitoto');
  });

  it('falls back to the legacy flat field when no translation exists', () => {
    // This is every business in the product as of 2026-08-04 (FR-015a).
    expect(resolveLocalized('Lake Coatepeque', undefined, 'es')).toBe('Lake Coatepeque');
  });

  it('prefers a translation over the legacy field', () => {
    expect(resolveLocalized('Old name', both, 'es')).toBe('Playa El Tunco');
  });

  it('treats whitespace as absent, not as a translation', () => {
    expect(resolveLocalized('Legacy', { es: '   ', en: '' }, 'es')).toBe('Legacy');
  });

  it('trims what it returns', () => {
    expect(resolveLocalized(undefined, { es: '  Tazumal  ', en: '' }, 'es')).toBe('Tazumal');
  });

  it('returns an empty string when there is nothing at all', () => {
    // Never `undefined`: callers render this directly, and "undefined" on a card
    // is worse than a blank.
    expect(resolveLocalized(undefined, undefined, 'es')).toBe('');
  });
});

describe('isLocalizedComplete', () => {
  it('requires both languages non-empty', () => {
    expect(isLocalizedComplete({ es: 'Hola', en: 'Hello' })).toBe(true);
    expect(isLocalizedComplete({ es: 'Hola', en: '' })).toBe(false);
    expect(isLocalizedComplete(undefined)).toBe(false);
  });

  it('rejects a whitespace-only translation', () => {
    // Otherwise a space bar satisfies the publication minimum (FR-015).
    expect(isLocalizedComplete({ es: 'Hola', en: '   ' })).toBe(false);
  });
});

describe('hasAnyLanguage', () => {
  it('detects a partially filled value', () => {
    expect(hasAnyLanguage({ es: 'Hola', en: '' })).toBe(true);
    expect(hasAnyLanguage({ es: '', en: '' })).toBe(false);
    expect(hasAnyLanguage(undefined)).toBe(false);
  });
});

describe('localizedText', () => {
  it('trims both sides on the way in', () => {
    expect(localizedText('  Hola  ', ' Hello ')).toEqual({ es: 'Hola', en: 'Hello' });
  });
});
