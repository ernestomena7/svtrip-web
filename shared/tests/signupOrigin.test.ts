// Feature 025 (T006): the link origin is a short slug or a fixed word — never free text. A count table
// that stores whatever arrives in `utm_source` becomes a place to store arbitrary strings (R7).
import { describe, expect, it } from 'vitest';
import { normaliseOrigin } from '../src/signupOrigin.js';

describe('normaliseOrigin', () => {
  it('lower-cases a valid slug', () => {
    expect(normaliseOrigin('Invitacion-DIC')).toBe('invitacion-dic');
  });
  it('keeps digits, dash and underscore', () => {
    expect(normaliseOrigin('mail_2026-12')).toBe('mail_2026-12');
  });
  it('turns anything longer than 32 characters into "other"', () => {
    expect(normaliseOrigin('a'.repeat(33))).toBe('other');
    expect(normaliseOrigin('a'.repeat(32))).toBe('a'.repeat(32));
  });
  it('turns spaces, punctuation and non-ASCII into "other"', () => {
    expect(normaliseOrigin('a b')).toBe('other');
    expect(normaliseOrigin('<script>')).toBe('other');
    expect(normaliseOrigin('campaña')).toBe('other');
  });
  it('turns nothing into "direct"', () => {
    expect(normaliseOrigin(undefined)).toBe('direct');
    expect(normaliseOrigin(null)).toBe('direct');
    expect(normaliseOrigin('')).toBe('direct');
    expect(normaliseOrigin('   ')).toBe('direct');
  });
  it('never trusts a non-string', () => {
    expect(normaliseOrigin(42 as unknown as string)).toBe('other');
  });
});
