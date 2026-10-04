// An icon a super admin assigned to a taxonomy entry (feature 014, US4).
//
// WHY THIS IS NOT THE `Icon` COMPONENT
//
// `Icon` is 38 hand-ported line glyphs, self-contained, and every one of them is
// a code change to add. That is exactly the constraint US4 exists to remove:
// feature 010 made moods admin-managed, but choosing a mood's icon still meant a
// release. This component draws from Material Symbols instead — 4,271 icons, any
// of which a super admin can pick from the taxonomy manager.
//
// It is a **deliberate Principle VI deviation**, logged in the feature's
// Complexity Tracking rather than claimed compliant: VI names the `Icon`
// component explicitly. It is bounded to admin-assigned taxonomy icons and must
// not spread into product chrome — the moment it becomes the general-purpose
// set, the product has two of those and no rule.
//
// TWO THINGS THAT LOOK LIKE DETAILS AND ARE NOT
//
// 1. **Rendered by CODEPOINT, never by ligature.** The usual Material Symbols
//    idiom is `<span class="material-symbols">person_check</span>`, where the
//    font turns the text into a glyph. If the font is not there, the browser
//    paints the words `person_check` into the UI. Same class as the Google
//    avatar that rendered a broken-image icon: a resource that always works,
//    until it doesn't, with a fallback that cannot see the failure.
//
// 2. **The font is BUNDLED, not fetched.** `fonts.googleapis.com` would work in
//    a browser and fail in an installed app whose first launch is offline
//    (FR-032, FR-037).
import type { CSSProperties } from 'react';

export interface TaxonomyIconProps {
  /**
   * The glyph, as stored on the taxonomy entry by the server.
   *
   * A hex codepoint like `f565`, NOT a name. The name→codepoint map is 4,271
   * entries and 94 KB; keeping it on the server and in the admin form means the
   * mobile app carries neither.
   */
  codepoint?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible label. Omit for a decorative icon beside its own text label. */
  label?: string;
}

export function TaxonomyIcon({ codepoint, size = 24, className, style, label }: TaxonomyIconProps) {
  if (!codepoint) return null;

  // Codepoints are stored as hex without a prefix (`f565`). Anything else is a
  // corrupt value, and rendering nothing beats rendering a replacement box.
  //
  // `Number.isFinite` alone is not the check. `String.fromCodePoint` THROWS a
  // RangeError outside 0..0x10FFFF, and `parseInt('FFFFFFF', 16)` is a
  // perfectly finite 268435455 — so a long hex string in the admin icon field
  // would take down the render of every screen showing that entry, not just
  // the glyph. The field is authored by a super admin with no validation on
  // the way in (feature 014), which makes this reachable by a typo.
  const point = Number.parseInt(codepoint, 16);
  if (!Number.isInteger(point) || point < 1 || point > 0x10ffff) return null;

  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
      className={className}
      style={{
        fontFamily: 'Material Symbols Rounded',
        fontWeight: 400,
        fontStyle: 'normal',
        fontSize: size,
        lineHeight: 1,
        // Reserve the space so the tile does not reflow when the glyph arrives
        // (FR-039). Without this the label jumps on first paint.
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // The ligature machinery is off. Even with a codepoint, leaving these on
        // lets an unexpected string render as words.
        fontVariantLigatures: 'none',
        letterSpacing: 'normal',
        textTransform: 'none',
        whiteSpace: 'nowrap',
        wordWrap: 'normal',
        direction: 'ltr',
        WebkitFontSmoothing: 'antialiased',
        ...style,
      }}
    >
      {String.fromCodePoint(point)}
    </span>
  );
}
