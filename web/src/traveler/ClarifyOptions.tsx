// The tappable answers to a clarifying question, desktop surface (feature 012,
// T016 — FR-006).
//
// Duplicated per surface rather than shared, following the precedent this
// project already set for the location picker (008 research R1) and the mood
// editors (009): the RULES live once in `shared/`, the presentation belongs to
// each surface's own idiom. The pill treatment below matches this surface's
// profile mood editor exactly.
import { useTranslation } from 'react-i18next';
import type { ClarifyOption } from '@svtrip/shared';
import { TaxonomyGlyph } from '@svtrip/core/TaxonomyGlyph';
import { useMergedTaxonomy } from '@svtrip/core/taxonomy/useTaxonomy';
import { MOODS } from '@svtrip/shared';
import { cx } from '../components/ui';

export function ClarifyOptions({
  options,
  hintKey,
  onPick,
  disabled,
}: {
  options: ClarifyOption[];
  hintKey?: string;
  onPick: (option: ClarifyOption) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  // These options ARE moods (see the note at the top of this file), so an icon
  // a super admin assigned has to reach them too — FR-042 is about every place
  // a mood is drawn, not only the pickers.
  const { icon: moodGlyph } = useMergedTaxonomy('moods', MOODS);
  if (!options.length) return null;

  return (
    <div className="mt-3 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onPick(option)}
            className={cx(
              'inline-flex items-center gap-2 rounded-pill border px-3.5 py-2 text-sm font-bold transition',
              'border-border bg-surface text-text hover:bg-surface-2',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {/* Falls back rather than rendering an undefined icon for an
                admin-created mood that carries none (feature 010). */}
            <TaxonomyGlyph resolved={moodGlyph(option.icon ?? option.value)} size={15} />
            {/* Resolved here, not on the server: a stored reply renders in the
                language the traveler is using now. */}
            {t(option.labelKey)}
          </button>
        ))}
      </div>
      {hintKey && <p className="text-xs text-muted">{t(hintKey)}</p>}
    </div>
  );
}
