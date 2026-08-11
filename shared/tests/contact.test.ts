// Contact number validation (FR-032).
//
// The bias here is deliberate: a false rejection means a real business cannot
// save a real number, which is worse than accepting one that turns out to be
// unreachable. Anything deeper than "is this in international format" is a
// promise this codebase cannot keep.
import { describe, expect, it } from 'vitest';
import { isValidPhone, normalizePhone } from '../src/contact.js';

describe('isValidPhone', () => {
  it('accepts a full international number', () => {
    expect(isValidPhone('+50370000000')).toBe(true);
  });

  it('accepts the separators people actually type', () => {
    expect(isValidPhone('+503 7000-0000')).toBe(true);
    expect(isValidPhone('+503 (7000) 0000')).toBe(true);
  });

  it('accepts empty — a business with no phone is a normal business', () => {
    // A national park has none, and blocking the save would strand the whole
    // profile over a field that is optional by design.
    expect(isValidPhone('')).toBe(true);
    expect(isValidPhone(undefined)).toBe(true);
    expect(isValidPhone('   ')).toBe(true);
  });

  it('rejects a number with no country code', () => {
    // The contact link is built from this verbatim; a local number opens a chat
    // with the wrong person or nobody at all.
    expect(isValidPhone('70000000')).toBe(false);
  });

  it('rejects letters and obviously truncated input', () => {
    expect(isValidPhone('+503 llamame')).toBe(false);
    expect(isValidPhone('+5037')).toBe(false);
  });

  it('rejects a leading +0', () => {
    expect(isValidPhone('+0370000000')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('strips separators so the stored value is link-ready', () => {
    expect(normalizePhone('+503 (7000) 00-00')).toBe('+50370000000');
  });
});
