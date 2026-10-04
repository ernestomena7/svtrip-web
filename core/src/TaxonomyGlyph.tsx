// Draws whichever icon a taxonomy entry resolved to (feature 014, US4).
//
// Two icon sets now coexist in this product — the brand's 38 hand-ported line
// glyphs, and Material Symbols for icons a super admin assigns. That is a
// deliberate, logged Principle VI deviation, and this component is what keeps it
// from leaking: eleven call sites render a mood's icon, and none of them should
// have to know which set a given value came from.
//
// Give it the result of `resolveEntryIcon` and it picks the renderer.
import { Icon } from './Icon';
import { TaxonomyIcon } from './TaxonomyIcon';
import type { ResolvedIcon } from './moodIcons';

export function TaxonomyGlyph({
  resolved,
  size = 24,
  label,
}: {
  resolved: ResolvedIcon;
  size?: number;
  /** Accessible name. Omit beside a visible text label — the usual case here. */
  label?: string;
}) {
  // The brand set: inline SVG, self-contained, what every other icon in the
  // product is drawn with.
  if (resolved.kind === 'builtIn') {
    // `Icon` takes no accessible name, so the label is carried by a wrapper
    // rather than dropped. Before this, the same glyph announced itself on the
    // Material Symbols branch and was silent on this one — the difference
    // being which icon set a super admin happened to pick.
    if (label) {
      return (
        <span role="img" aria-label={label} style={{ display: 'inline-flex' }}>
          <Icon name={resolved.name} size={size} />
        </span>
      );
    }
    return <Icon name={resolved.name} size={size} />;
  }
  // Material Symbols, by codepoint. Covers both an assigned icon and the
  // per-vocabulary default.
  return <TaxonomyIcon codepoint={resolved.codepoint} size={size} label={label} />;
}
