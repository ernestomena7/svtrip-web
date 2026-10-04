// @vitest-environment jsdom
//
// The codepoint guard, and the crash it prevents.
//
// `TaxonomyIcon` rejected a bad codepoint with `Number.isFinite`, which does not
// describe the range `String.fromCodePoint` accepts. `parseInt('FFFFFFF', 16)`
// is a perfectly finite 268435455 and `fromCodePoint` throws a RangeError on it
// — thrown during render, so it takes down the whole tree, not just the glyph.
//
// The value comes from the super-admin icon field added in feature 014, typed by
// hand with no validation on the way in. A slip of the keyboard there would have
// blanked every screen showing that mood.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TaxonomyIcon } from '../src/TaxonomyIcon';

/** What the component actually paints, or '' when it declines to paint. */
function glyphOf(codepoint: string): string {
  const { container } = render(<TaxonomyIcon codepoint={codepoint} />);
  return container.textContent ?? '';
}

describe('a codepoint outside the Unicode range is refused, not thrown on', () => {
  it('does not crash on a long hex string', () => {
    // The regression. Before the fix this threw RangeError out of render.
    expect(() => glyphOf('FFFFFFF')).not.toThrow();
    expect(glyphOf('FFFFFFF')).toBe('');
  });

  it('refuses a value above the last code point', () => {
    // 0x110000 is one past the maximum, and the first value fromCodePoint rejects.
    expect(glyphOf('110000')).toBe('');
  });

  it('refuses zero, which is a valid code point but never an icon', () => {
    // U+0000 renders as an invisible NUL rather than a glyph — a blank tile that
    // looks like a loading bug.
    expect(glyphOf('0')).toBe('');
  });

  it('refuses text', () => {
    expect(glyphOf('no-soy-hex')).toBe('');
  });
});

describe('a real Material Symbols codepoint still renders', () => {
  it('paints the glyph for the default icon', () => {
    // person_check — the fallback feature 014 gives an entry with no icon set.
    expect(glyphOf('f565')).toBe(String.fromCodePoint(0xf565));
  });

  it('paints one at the top of the valid range', () => {
    expect(glyphOf('10FFFF')).toBe(String.fromCodePoint(0x10ffff));
  });
});
