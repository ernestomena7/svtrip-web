// The guard that was missing, and the one defect it let through.
//
// `coordinates.ts` shipped with a header warning that "a blank field must not
// read as a valid equator" — and then the listing form on BOTH surfaces asked
// `isValidLat(Number(lat))`, which cannot see a blank field at all. A manager
// who filled the form and never touched the map saved the business at 0,0.
//
// The first describe below is the regression: it fails against the old
// call-site expression and passes against `isLatInput`.
import { describe, it, expect } from 'vitest';
import { isValidLat, isValidLng, isLatInput, isLngInput } from '../src/coordinates.js';

describe('a blank field is not the equator', () => {
  it('rejects an empty string', () => {
    // The exact bug: Number('') is 0, and 0 passes every range check there is.
    expect(Number('')).toBe(0);
    expect(isValidLat(Number(''))).toBe(true); // ← what the form used to ask
    expect(isLatInput('')).toBe(false); // ← what it asks now
    expect(isLngInput('')).toBe(false);
  });

  it('rejects whitespace, which an empty check on the raw value would miss', () => {
    expect(isLatInput('   ')).toBe(false);
    expect(isLngInput('\t')).toBe(false);
  });

  it('still rejects text', () => {
    expect(isLatInput('abc')).toBe(false);
    expect(isLngInput('cero')).toBe(false);
  });
});

describe('a real coordinate still passes', () => {
  it('accepts El Salvador', () => {
    // El Tunco, roughly. A location the product actually carries.
    expect(isLatInput('13.4939')).toBe(true);
    expect(isLngInput('-89.3819')).toBe(true);
  });

  it('accepts a deliberate zero', () => {
    // 0,0 is a real place. Only ABSENCE is refused — someone who types the
    // digit is taken at their word, exactly as before.
    expect(isLatInput('0')).toBe(true);
    expect(isLngInput('0')).toBe(true);
  });

  it('holds the range at the poles and the antimeridian', () => {
    expect(isLatInput('90')).toBe(true);
    expect(isLatInput('90.1')).toBe(false);
    expect(isLngInput('-180')).toBe(true);
    expect(isLngInput('180.1')).toBe(false);
  });
});
