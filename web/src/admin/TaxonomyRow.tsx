// One taxonomy entry, as a row that can open into an editor (feature 019).
//
// WHY THIS IS ITS OWN FILE, and not more state on `TaxonomyScreen`.
//
// FR-011b requires that at most one row be open at a time, and that a cancel
// never discard a draft the operator was keeping somewhere else. With the draft
// living in the ROW, both hold by construction: a row that is not open holds no
// draft, and closing one cannot touch another. Keeping the draft on the screen
// would mean one object per row in the screen's state and "only one open" as an
// invariant somebody has to maintain by hand.
//
// The screen still owns which row is open, because that is the one piece of
// state no single row can know.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TaxonomyEntry, TaxonomyVocabulary, ServiceScope } from '@svtrip/shared';
import { resolveTaxonomyLabel } from '@svtrip/core/taxonomy/resolveTaxonomyLabel';
import { patchJson } from '@svtrip/core/apiClient';
import { Button, Field, TextInput, cx } from '../components/ui';
import { IconField, isSubmittableIcon } from './IconField';
import { ScopePicker } from './ScopePicker';

/** What a save sends. Deliberately NOT `active` — deactivation is its own control. */
interface EditPatch {
  labelI18n?: { es: string; en: string };
  icon?: string | null;
  scope?: ServiceScope;
}

export function TaxonomyRow({
  vocabulary,
  entryKey,
  entry,
  isBuiltIn,
  active,
  language,
  busy,
  editing,
  onToggle,
  onEditOpen,
  onEditClose,
  onSaved,
}: {
  vocabulary: TaxonomyVocabulary;
  entryKey: string;
  entry: TaxonomyEntry | undefined;
  isBuiltIn: boolean;
  active: boolean;
  language: 'es' | 'en';
  busy: boolean;
  editing: boolean;
  onToggle: () => void;
  onEditOpen: () => void;
  onEditClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <span
            className={cx(
              'block font-display font-extrabold',
              active ? 'text-text' : 'text-muted line-through',
            )}
          >
            {resolveTaxonomyLabel(vocabulary, entryKey, entry, t, language)}
          </span>
          <span className="block text-xs text-muted">
            {entryKey}
            {!isBuiltIn && ` · ${t('admin.custom')}`}
            {/* FR-012: lightweight provenance, so a surprising change
                has a name and a date attached to it. */}
            {entry?.lastChangedAt
              ? ` · ${t('admin.changedAt', {
                  date: new Date(entry.lastChangedAt).toLocaleDateString(language),
                })}`
              : ''}
          </span>
        </span>
        {!editing && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={onEditOpen}>
            {t('admin.edit')}
          </Button>
        )}
        <Button
          size="sm"
          variant={active ? 'secondary' : 'primary'}
          disabled={busy}
          onClick={onToggle}
        >
          {active ? t('admin.deactivate') : t('admin.reactivate')}
        </Button>
      </div>

      {editing && (
        <EntryEditor
          vocabulary={vocabulary}
          entryKey={entryKey}
          entry={entry}
          onCancel={onEditClose}
          onSaved={onSaved}
        />
      )}
    </li>
  );
}

/**
 * The open state: a draft of the editable fields, and nothing else.
 *
 * Mounted only while the row is open, so cancelling is unmounting and there is
 * no stale draft to reset — the bug class feature 016 hit when it re-seeded
 * drag order from derived state.
 */
function EntryEditor({
  vocabulary,
  entryKey,
  entry,
  onCancel,
  onSaved,
}: {
  vocabulary: TaxonomyVocabulary;
  entryKey: string;
  entry: TaxonomyEntry | undefined;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();

  // FR-005a: prefilled with what RENDERS today, not with the stored value.
  // 58 of 63 entries have no `labelI18n` at all, so reading the field would
  // leave an operator staring at two empty boxes on an entry that visibly has a
  // name. `resolveTaxonomyLabel` is the same function the closed row uses.
  const [es, setEs] = useState(() =>
    entry?.labelI18n?.es ?? resolveTaxonomyLabel(vocabulary, entryKey, entry, t, 'es'),
  );
  const [en, setEn] = useState(() =>
    entry?.labelI18n?.en ?? resolveTaxonomyLabel(vocabulary, entryKey, entry, t, 'en'),
  );
  const [icon, setIcon] = useState(entry?.icon ?? '');
  // Services only. An entry with no scope stored is universal, which is what
  // `coversType` already assumes everywhere else — 0 of 39 carry one today.
  const isService = vocabulary === 'services';
  const loadedUniversal = entry?.scope?.universal !== false;
  const loadedTypes = entry?.scope?.universal === false ? entry.scope.businessTypes : [];
  const [universal, setUniversal] = useState(loadedUniversal);
  const [types, setTypes] = useState<string[]>([...loadedTypes]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadedIcon = entry?.icon ?? '';
  const labelsFilled = es.trim().length > 0 && en.trim().length > 0;
  const labelChanged =
    es !== (entry?.labelI18n?.es ?? resolveTaxonomyLabel(vocabulary, entryKey, entry, t, 'es')) ||
    en !== (entry?.labelI18n?.en ?? resolveTaxonomyLabel(vocabulary, entryKey, entry, t, 'en'));
  const iconChanged = icon.trim() !== loadedIcon;
  const scopeChanged =
    isService &&
    (universal !== loadedUniversal ||
      (!universal && types.join('|') !== [...loadedTypes].join('|')));
  const changed = labelChanged || iconChanged || scopeChanged;
  // FR-009: a service offered nowhere is a dead entry, not a configuration.
  const scopeUsable = !isService || universal || types.length > 0;

  // Disabled until valid AND different, the rule kept from the Plans tab (R7).
  // A save with nothing changed stamps a fresh `lastChangedAt` onto an entry
  // nobody edited, which corrupts the provenance FR-012 depends on.
  const canSave = labelsFilled && isSubmittableIcon(icon) && scopeUsable && changed && !saving;

  async function save() {
    const patch: EditPatch = {};
    if (labelChanged) patch.labelI18n = { es: es.trim(), en: en.trim() };
    // The tri-state the service already implements, expressed at the call site
    // because `IconField` cannot express it (research R2):
    //
    //   unchanged       -> absent   leave the existing icon alone
    //   cleared         -> null     REMOVE it
    //   a name          -> string   set it
    //
    // The create form maps an empty field to *omitted*, which is right on a
    // create and wrong here: it would make "remove the icon" a write that
    // reports success and changes nothing.
    if (iconChanged) patch.icon = icon.trim() === '' ? null : icon.trim();
    // Sent only when it moved, so a relabel does not rewrite a scope nobody touched.
    if (scopeChanged) {
      patch.scope = universal ? { universal: true } : { universal: false, businessTypes: types };
    }

    setSaving(true);
    setError(null);
    try {
      await patchJson(`/admin/taxonomy/${vocabulary}/${encodeURIComponent(entryKey)}`, patch);
      onSaved();
    } catch (err) {
      // FR-011c: the row stays OPEN with what was typed. The failures this will
      // actually meet — a dropped connection, a 403 from an expired session —
      // are retried unchanged, so closing would turn a one-click retry into
      // retyping every field.
      setError(err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 grid gap-3 rounded-lg bg-surface-2 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('admin.labelEs')}>
          {/* `autoFocus`, NOT a ref: `TextInput` is a plain function component and
              does not forward refs, so a ref would be dropped with a warning and the
              focus would silently never move. Making it forward refs would mean
              changing a component every other screen shares, to serve one row.
              Opening a row still moves focus into it, which is what a keyboard user
              needs in a 39-row list (design-review.md). */}
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <TextInput autoFocus value={es} onChange={(e) => setEs(e.target.value)} />
        </Field>
        <Field label={t('admin.labelEn')}>
          <TextInput value={en} onChange={(e) => setEn(e.target.value)} />
        </Field>
      </div>

      <IconField value={icon} onChange={setIcon} />

      {isService && (
        <ScopePicker
          universal={universal}
          types={types}
          onUniversalChange={setUniversal}
          onTypesChange={setTypes}
        />
      )}

      {/* FR-005b. A statement of consequence, not a warning — the operator did
          nothing wrong, and an alert styling would say they had. */}
      <p className="text-xs text-muted">{t('admin.editNotice')}</p>

      {!labelsFilled && <p className="text-xs font-bold text-primary">{t('admin.labelRequired')}</p>}
      {!scopeUsable && (
        <p className="text-xs font-bold text-primary">{t('admin.scopeNeedsType')}</p>
      )}
      {error && <p className="text-xs font-bold text-primary">{error}</p>}

      <div className="flex gap-2">
        <Button size="sm" disabled={!canSave} onClick={() => void save()}>
          {t('common.save')}
        </Button>
        <Button size="sm" variant="secondary" disabled={saving} onClick={onCancel}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
