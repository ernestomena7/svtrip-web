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
    return <Icon name={resolved.name} size={size} />;
  }
  // Material Symbols, by codepoint. Covers both an assigned icon and the
  // per-vocabulary default.
  return <TaxonomyIcon codepoint={resolved.codepoint} size={size} label={label} />;
}
