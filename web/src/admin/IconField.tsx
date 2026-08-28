// Choosing an icon for a taxonomy entry (feature 014, US4).
//
// The point of the whole story: before this, deciding which icon a mood shows
// was a code change. Feature 010 made moods admin-managed, but `moodIcon()`
// still resolved through a hand-written map, so a mood a super admin created
// landed in the traveler's grid looking generic. Now they pick one here.
//
// Web-only, and that is why the 4,271-name map ships here and nowhere else
// (FR-043). The mobile app renders the codepoint the server stored and carries
// neither the map nor a validator.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TaxonomyIcon } from '@svtrip/core/TaxonomyIcon';
import { TextInput, cx } from '../components/ui';
import NAMES from '../assets/material-symbols-names.json';

const ICONS = NAMES as Record<string, string>;

/** A handful of suggestions, so the field is not a blank box over 4,271 options. */
const SUGGESTIONS = [
  'beach_access',
  'hiking',
  'restaurant',
  'nightlife',
  'local_bar',
  'surfing',
  'museum',
  'favorite',
  'family_restroom',
  'landscape',
  'storefront',
  'person_check',
];

export function IconField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const codepoint = trimmed ? ICONS[trimmed] : undefined;
  // Empty is VALID — the field is optional and an entry with no icon falls back
  // (FR-035). Only a non-empty name that resolves to nothing is an error.
  const invalid = trimmed.length > 0 && !codepoint;

  // Cheap prefix match. A full fuzzy search over 4,271 names would be a nicer
  // toy and is not what an admin naming one icon needs.
  const matches = useMemo(() => {
    if (!trimmed || codepoint) return [];
    const q = trimmed.toLowerCase();
    return Object.keys(ICONS)
      .filter((n) => n.startsWith(q))
      .slice(0, 8);
  }, [trimmed, codepoint]);

  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-muted">{t('admin.icon')}</span>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <TextInput
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="beach_access"
              aria-invalid={invalid || undefined}
            />
          </div>
          {/*
            The preview (FR-028). An admin sees exactly what travelers will see
            BEFORE saving — which is the difference between choosing an icon and
            guessing at a name.
          */}
          <div
            className={cx(
              'flex h-11 w-11 flex-none items-center justify-center rounded-md border',
              codepoint ? 'border-border bg-surface text-text' : 'border-dashed border-border text-muted',
            )}
            data-testid="icon-preview"
          >
            {codepoint ? <TaxonomyIcon codepoint={codepoint} size={24} /> : <span>—</span>}
          </div>
        </div>
      </label>

      {invalid && touched && (
        <p className="text-xs font-bold text-primary">{t('admin.iconUnknown')}</p>
      )}

      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-xs font-bold text-text hover:bg-surface-2"
            >
              <TaxonomyIcon codepoint={ICONS[name]} size={14} />
              {name}
            </button>
          ))}
        </div>
      )}

      {!trimmed && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              aria-label={name}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-muted hover:bg-surface-2 hover:text-text"
            >
              <TaxonomyIcon codepoint={ICONS[name]} size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Whether a value may be submitted.
 *
 * Empty passes: the field is optional. This is a convenience, NOT a boundary —
 * the server checks the same thing against the same list, because a form is not
 * a security or integrity control (FR-029).
 */
export function isSubmittableIcon(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || Boolean(ICONS[trimmed]);
}
