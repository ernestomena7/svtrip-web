// Traveler profile rules (feature 011).
//
// The centrepiece of this file is the boundary between its two describe blocks.
// "Existing accounts are exempt" means exempt from having to PROVIDE a field
// they were never asked for — never exempt from VALIDATION of a value they are
// providing now. Those are two questions, answered by two functions, and the day
// they get merged is the day an account from before this feature can save an age
// of "treinta". The last block exists to fail on that day.
import { describe, it, expect } from 'vitest';
import {
  COUNTRY_CODES,
  DEFAULT_RESIDENCE_COUNTRY,
  MAX_AGE,
  MIN_AGE,
  deriveDisplayName,
  isProfileComplete,
  isValidAge,
  missingProfileFields,
  parseAge,
  predatesProfileFields,
  validateProfileFields,
} from '../src/profile.js';

const complete = {
  firstName: 'Neto',
  lastName: 'Mena',
  gender: 'masculine' as const,
  age: 34,
  countryCode: 'SV',
};

describe('the country reference list', () => {
  it('holds codes, never names, and includes the default', () => {
    expect(COUNTRY_CODES).toContain(DEFAULT_RESIDENCE_COUNTRY);
    // Every entry is a two-letter ISO code. A name slipping in here would mean
    // the locale files were about to grow by ~500 keys.
    expect(COUNTRY_CODES.every((c) => /^[A-Z]{2}$/.test(c))).toBe(true);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it('resolves to localized names through the platform, in both languages', () => {
    const es = new Intl.DisplayNames(['es'], { type: 'region' });
    const en = new Intl.DisplayNames(['en'], { type: 'region' });
    expect(es.of('SV')).toBe('El Salvador');
    expect(es.of('US')).toBe('Estados Unidos');
    expect(en.of('US')).toBe('United States');
    // Not one country name ships in the locale files, and this is why.
    expect(COUNTRY_CODES.every((c) => es.of(c) && es.of(c) !== c)).toBe(true);
  });
});

describe('layer one — what was never provided', () => {
  it('reports nothing missing for a complete profile', () => {
    expect(missingProfileFields(complete)).toEqual([]);
    expect(isProfileComplete(complete)).toBe(true);
  });

  it('returns the FULL list, not the first gap', () => {
    // Revealing one at a time turns finishing a profile into a guessing game —
    // and the invitation has to name everything that is missing (FR-019).
    expect(missingProfileFields({})).toEqual([
      'firstName',
      'lastName',
      'gender',
      'age',
      'countryCode',
    ]);
  });

  it('shrinks as fields are filled, which is what makes partial saves useful', () => {
    // FR-020: an existing traveler closes the gaps over several visits.
    expect(missingProfileFields({ firstName: 'Neto', lastName: 'Mena' })).toEqual([
      'gender',
      'age',
      'countryCode',
    ]);
  });

  it('never reports marital status — it is optional everywhere (FR-005)', () => {
    expect(missingProfileFields(complete)).not.toContain('maritalStatus');
    expect(isProfileComplete({ ...complete, maritalStatus: undefined })).toBe(true);
  });

  it('treats whitespace as absent, because a space bar is not a name', () => {
    expect(missingProfileFields({ ...complete, firstName: '   ' })).toContain('firstName');
  });

  it('treats age 0 as PROVIDED, not missing — invalid is layer two"s job', () => {
    // A subtle one: `!0` is true, so a naive check would call a zero age
    // "missing" and let it through validation untouched.
    expect(missingProfileFields({ ...complete, age: 0 })).not.toContain('age');
    expect(validateProfileFields({ ...complete, age: 0 })).toContain('age');
  });
});

describe('layer two — whether a value being entered is acceptable', () => {
  it('accepts a valid profile', () => {
    expect(validateProfileFields(complete)).toEqual([]);
  });

  it('rejects an age outside a plausible human range', () => {
    expect(validateProfileFields({ age: MIN_AGE - 1 })).toContain('age');
    expect(validateProfileFields({ age: MAX_AGE + 1 })).toContain('age');
    expect(validateProfileFields({ age: MIN_AGE })).toEqual([]);
    expect(validateProfileFields({ age: MAX_AGE })).toEqual([]);
  });

  it('rejects a non-integer age', () => {
    expect(isValidAge(30.5)).toBe(false);
    expect(isValidAge(NaN)).toBe(false);
    expect(isValidAge('30')).toBe(false);
  });

  it('refuses text in the age field before it can reach storage', () => {
    // FR-003: the field takes digits only. `parseAge` is the guard behind it.
    expect(parseAge('treinta')).toBeUndefined();
    expect(parseAge('3o')).toBeUndefined();
    expect(parseAge('30.5')).toBeUndefined();
    expect(parseAge('-5')).toBeUndefined();
    expect(parseAge(' 34 ')).toBe(34);
  });

  it('rejects a gender, marital status or country outside the vocabulary', () => {
    expect(validateProfileFields({ gender: 'other' as never })).toContain('gender');
    expect(validateProfileFields({ maritalStatus: 'divorced' as never })).toContain('maritalStatus');
    expect(validateProfileFields({ countryCode: 'ZZ' })).toContain('countryCode');
  });

  it('says nothing about fields that are absent', () => {
    // Absence is layer one's question. If this ever reports on `{}`, the two
    // layers have been merged and grandfathering is broken.
    expect(validateProfileFields({})).toEqual([]);
  });
});

describe('grandfathering — the boundary between the two layers (FR-018 vs FR-021)', () => {
  const oldAccount = { profileVersion: undefined };
  const newAccount = { profileVersion: 11 };

  it('recognises an account that predates the feature by the absent stamp', () => {
    expect(predatesProfileFields(oldAccount)).toBe(true);
    expect(predatesProfileFields(newAccount)).toBe(false);
  });

  it('lets an old, empty profile exist without being invalid', () => {
    // It is INCOMPLETE (so it gets the invitation) but not INVALID (so nothing
    // it does is refused). Both statements have to be true at once, and they are
    // only expressible because the two layers are separate functions.
    expect(missingProfileFields({}).length).toBeGreaterThan(0);
    expect(validateProfileFields({})).toEqual([]);
  });

  it('still refuses a bad value from an old account', () => {
    // THE regression this file exists for. Being exempt from providing a field
    // is not being exempt from the rules about it.
    expect(validateProfileFields({ age: 200 })).toContain('age');
    expect(parseAge('treinta')).toBeUndefined();
  });
});

describe('the derived display name', () => {
  it('joins the two names', () => {
    expect(deriveDisplayName('Neto', 'Mena')).toBe('Neto Mena');
  });

  it('trims, so a stray space never reaches a public review byline', () => {
    expect(deriveDisplayName('  Neto  ', '  Mena ')).toBe('Neto Mena');
  });

  it('never returns leading or trailing space when one half is empty', () => {
    // Both server services fall back to a generic placeholder on an empty
    // string, so " Mena" would render as itself while "" renders as "Viajero".
    expect(deriveDisplayName('', 'Mena')).toBe('Mena');
    expect(deriveDisplayName('', '')).toBe('');
  });
});
