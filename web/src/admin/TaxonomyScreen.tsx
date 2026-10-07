// The super-admin taxonomy manager (feature 010) — web only, by instruction.
//
// One screen parameterized by vocabulary, matching the API it drives: business
// types, moods and services share a document shape and an authorization rule, so
// three copies would be three places for them to drift.
//
// The access check here is VISIBILITY only. `requireSuperAdmin` on the BFF is
// the boundary; this just avoids showing a screen whose every button would 403.
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import type { ServiceScope, TaxonomyEntry, TaxonomyVocabulary } from '@svtrip/shared';
import { BUSINESS_TYPES, MOODS, ALL_SERVICES } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { patchJson, postJson } from '@svtrip/core/apiClient';
import { useTaxonomy } from '@svtrip/core/taxonomy/useTaxonomy';
import { Button, Card, ErrorState, Spinner, TextInput, cx } from '../components/ui';
import { IconField, isSubmittableIcon } from './IconField';
import { TaxonomyRow } from './TaxonomyRow';
import { ScopePicker } from './ScopePicker';
import { DesktopLayout } from '../shell/DesktopLayout';
import { useSuperAdmin } from './useSuperAdmin';
import { PlansPanel } from './PlansPanel';

/**
 * Feature 018 added a fourth tab that is NOT a vocabulary.
 *
 * Research R5: `VocabularyPanel` renders key/label/active rows, and a plan has
 * a price, a launch discount and an entitlement set. Forcing a plan into that
 * shape would either break the component's contract or produce a plan that
 * cannot express a price — so `plans` is a sibling panel and the tab state
 * widened to admit it.
 */
type AdminTab = TaxonomyVocabulary | 'plans';

const TABS: { id: AdminTab; labelKey: string; builtIn?: readonly string[] }[] = [
  { id: 'business-types', labelKey: 'admin.tabs.businessTypes', builtIn: BUSINESS_TYPES },
  { id: 'moods', labelKey: 'admin.tabs.moods', builtIn: MOODS },
  { id: 'services', labelKey: 'admin.tabs.services', builtIn: ALL_SERVICES },
  { id: 'plans', labelKey: 'admin.tabs.plans' },
];

export function TaxonomyScreen() {
  const { t } = useTranslation();
  const { isSuperAdmin, checking } = useSuperAdmin();
  const [tab, setTab] = useState<AdminTab>('business-types');

  if (checking) {
    return (
      <DesktopLayout>
        <Spinner label={t('common.loading')} />
      </DesktopLayout>
    );
  }
  // Denied looks the same as "this screen does not exist for you" — no hint
  // about what lives here (FR-002).
  if (!isSuperAdmin) return <Navigate to="/discover" replace />;

  const active = TABS.find((x) => x.id === tab)!;

  return (
    <DesktopLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
        {t('admin.title')}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">{t('admin.subtitle')}</p>

      <div className="mt-6 inline-flex rounded-pill bg-surface-2 p-1">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            aria-pressed={tab === x.id}
            className={cx(
              'rounded-pill px-4 py-2 text-sm font-bold transition',
              tab === x.id ? 'bg-surface text-text shadow-sm' : 'text-muted',
            )}
          >
            {t(x.labelKey)}
          </button>
        ))}
      </div>

      {/* Keyed so switching tabs resets the editor's local state rather than
          carrying a half-typed entry across vocabularies. */}
      {active.id === 'plans' ? (
        <PlansPanel />
      ) : (
        <VocabularyPanel
          key={active.id}
          vocabulary={active.id}
          builtIn={active.builtIn ?? []}
        />
      )}
    </DesktopLayout>
  );
}

function VocabularyPanel({
  vocabulary,
  builtIn,
}: {
  vocabulary: TaxonomyVocabulary;
  builtIn: readonly string[];
}) {
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);
  const { entries, loading, reload } = useTaxonomy(vocabulary);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const byKey = useMemo(() => new Map(entries.map((e) => [e.key, e])), [entries]);

  // Built-ins first, in their existing deliberate order, then admin-created.
  const rows = useMemo(() => {
    const extra = entries
      .filter((e) => !builtIn.includes(e.key))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((e) => e.key);
    return [...builtIn, ...extra];
  }, [entries, builtIn]);

  const isActive = (key: string) => byKey.get(key)?.active !== false;
  const activeCount = rows.filter(isActive).length;

  async function toggle(key: string) {
    const next = !isActive(key);
    // FR-011: deactivating the last active entry leaves every business owner or
    // traveler with nothing to choose. Warned, not blocked — a super admin may
    // have a reason mid-migration.
    if (!next && activeCount === 1 && !window.confirm(t('admin.confirmLastActive'))) return;
    setBusy(key);
    setError(null);
    try {
      await patchJson(`/admin/taxonomy/${vocabulary}/${encodeURIComponent(key)}`, { active: next });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 grid max-w-4xl gap-5">
      {error && <ErrorState message={error} />}

      <CreateEntryForm
        vocabulary={vocabulary}
        onCreated={() => {
          setError(null);
          reload();
        }}
        onError={setError}
      />

      <Card className="p-6">
        <p className="text-sm font-bold text-muted">{t('admin.existing')}</p>
        {loading ? (
          <div className="mt-4">
            <Spinner label={t('common.loading')} />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {rows.map((key) => (
              <TaxonomyRow
                key={key}
                vocabulary={vocabulary}
                entryKey={key}
                entry={byKey.get(key)}
                isBuiltIn={builtIn.includes(key)}
                active={isActive(key)}
                language={language}
                busy={busy === key}
                editing={editingKey === key}
                onToggle={() => void toggle(key)}
                // FR-011b: the SCREEN owns which row is open, because no single
                // row can know that another one is. Opening one closes the other
                // by construction rather than by anybody remembering to.
                onEditOpen={() => {
                  setError(null);
                  setEditingKey(key);
                }}
                onEditClose={() => setEditingKey(null)}
                onSaved={() => {
                  setEditingKey(null);
                  reload();
                }}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CreateEntryForm({
  vocabulary,
  onCreated,
  onError,
}: {
  vocabulary: TaxonomyVocabulary;
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [es, setEs] = useState('');
  const [en, setEn] = useState('');
  const [universal, setUniversal] = useState(true);
  const [types, setTypes] = useState<string[]>([]);
  const [icon, setIcon] = useState('');
  const [busy, setBusy] = useState(false);

  const isService = vocabulary === 'services';
  // FR-008: both languages, or it renders blank for half the product's users.
  const canSave =
    key.trim().length > 0 &&
    es.trim().length > 0 &&
    en.trim().length > 0 &&
    // Optional, so blank passes — but a name that resolves to nothing must not
    // be submittable (FR-029). The server checks the same thing; this only
    // saves the admin a round trip.
    isSubmittableIcon(icon) &&
    (!isService || universal || types.length > 0);

  async function submit() {
    setBusy(true);
    try {
      const scope: ServiceScope | undefined = isService
        ? universal
          ? { universal: true }
          : { universal: false, businessTypes: types }
        : undefined;
      await postJson<{ entry: TaxonomyEntry }>(`/admin/taxonomy/${vocabulary}`, {
        key: key.trim(),
        labelI18n: { es: es.trim(), en: en.trim() },
        ...(scope ? { scope } : {}),
        ...(icon.trim() ? { icon: icon.trim() } : {}),
      });
      setKey('');
      setEs('');
      setEn('');
      setIcon('');
      setTypes([]);
      setUniversal(true);
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : t('common.somethingWrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-6">
      <p className="text-sm font-bold text-muted">{t('admin.addNew')}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">{t('admin.key')}</span>
          <TextInput
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="food-truck"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">{t('admin.labelEs')}</span>
          <TextInput value={es} onChange={(e) => setEs(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-muted">{t('admin.labelEn')}</span>
          <TextInput value={en} onChange={(e) => setEn(e.target.value)} />
        </label>
      </div>

      {/* Offered for ALL THREE vocabularies (D2): the field lives on the
          taxonomy entry, not on a mood, so moods, business types and services
          all carry it under identical rules. */}
      <IconField value={icon} onChange={setIcon} />

      {isService && (
        <ScopePicker
          universal={universal}
          types={types}
          onUniversalChange={setUniversal}
          onTypesChange={setTypes}
        />
      )}

      <Button disabled={!canSave || busy} onClick={() => void submit()}>
        {t('admin.create')}
      </Button>
    </Card>
  );
}
