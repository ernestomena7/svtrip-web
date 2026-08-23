// Reading the admin-managed vocabularies from the client (feature 010).
//
// Reads are direct-Firestore, deliberately: every signed-in user's pickers need
// this, so routing them through the BFF would add latency for no security
// benefit. WRITES are the privileged half and go through the BFF — the rules
// deny client writes outright (contracts/firestore-rules.md).
//
// Cached at module scope like `discoverRepo`'s catalog: these are three tiny
// collections read by several screens, and refetching per mount would make a
// picker feel slower than the constant it replaced.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, getDocs } from 'firebase/firestore';
import type { TaxonomyEntry, TaxonomyVocabulary } from '@svtrip/shared';
import { TAXONOMY_COLLECTION, mergeTaxonomyKeys, serviceAppliesTo } from '@svtrip/shared';
import { db } from '../firebase';
import { useUiStore } from '../uiStore';
import { taxonomyLabeller } from './resolveTaxonomyLabel';

const cache = new Map<TaxonomyVocabulary, TaxonomyEntry[]>();

/** Drop the cache so the next read sees a just-saved admin change. */
export function invalidateTaxonomy(vocabulary?: TaxonomyVocabulary): void {
  if (vocabulary) cache.delete(vocabulary);
  else cache.clear();
}

export async function fetchTaxonomy(vocabulary: TaxonomyVocabulary): Promise<TaxonomyEntry[]> {
  const cached = cache.get(vocabulary);
  if (cached) return cached;
  try {
    const snap = await getDocs(collection(db, TAXONOMY_COLLECTION[vocabulary]));
    const entries = snap.docs.map((d) => ({ ...(d.data() as TaxonomyEntry), key: d.id }));
    cache.set(vocabulary, entries);
    return entries;
  } catch {
    // A vocabulary that cannot be read must not empty the picker it feeds: the
    // built-in constants are still the baseline, and an empty list here means
    // "no admin overrides", which is exactly the pre-feature behaviour.
    return [];
  }
}

/**
 * The admin-managed entries for one vocabulary.
 *
 * Returns [] while loading and on failure — both mean "no overrides", which
 * leaves every caller rendering the built-in constants it always did.
 */
export function useTaxonomy(vocabulary: TaxonomyVocabulary): {
  entries: TaxonomyEntry[];
  loading: boolean;
  reload: () => void;
} {
  const [entries, setEntries] = useState<TaxonomyEntry[]>(() => cache.get(vocabulary) ?? []);
  const [loading, setLoading] = useState(!cache.has(vocabulary));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(!cache.has(vocabulary));
    void fetchTaxonomy(vocabulary).then((e) => {
      if (cancelled) return;
      setEntries(e);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [vocabulary, nonce]);

  return {
    entries,
    loading,
    reload: () => {
      invalidateTaxonomy(vocabulary);
      setNonce((n) => n + 1);
    },
  };
}

/**
 * What a picker actually needs: the keys to offer, and how to label each one.
 *
 * Every mood/type/service picker on both surfaces goes through this, so an
 * admin change lands everywhere at once. Doing the merge per-picker instead is
 * how a business type ends up offered on one screen and missing on another —
 * the same class of drift `scoreSignalFor` and `resolveLocalized` exist to
 * prevent for scores and bilingual copy.
 *
 * `alwaysInclude` keeps a value a record ALREADY holds visible even after the
 * admin deactivates it: FR-006 removes an entry from new selections, it does not
 * rewrite records that reference it, and its owner should see what they have.
 */
export function useMergedTaxonomy(
  vocabulary: TaxonomyVocabulary,
  builtIn: readonly string[],
  alwaysInclude: readonly string[] = [],
): { keys: string[]; label: (key: string) => string } {
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);
  const { entries } = useTaxonomy(vocabulary);

  const keys = useMemo(() => {
    const merged = mergeTaxonomyKeys(builtIn, entries);
    const missing = alwaysInclude.filter((k) => k && !merged.includes(k));
    return missing.length ? [...merged, ...missing] : merged;
    // `alwaysInclude` is typically a fresh array each render; join it so the memo
    // keys on its contents rather than its identity.
  }, [entries, builtIn, alwaysInclude.join('|')]);

  const label = useMemo(
    () => taxonomyLabeller(vocabulary, entries, t, language),
    [vocabulary, entries, t, language],
  );

  return { keys, label };
}

/**
 * The services a business of this type may advertise, built-in and admin-added.
 *
 * The scope rule lives here rather than in each listing form, for the same
 * reason `servicesFor()` owns the built-in mapping rather than each picker: two
 * copies drift, and the failure is silent — a service offered on one surface and
 * missing on the other, with nothing to notice it.
 *
 * Built-in scope stays with `servicesFor()`; admin-created entries carry their
 * own `scope` (FR-007). Anything the business ALREADY offers stays listed even
 * once deactivated, so its owner sees what they have (FR-006).
 */
export function useScopedServices(
  businessType: string | undefined,
  builtInForType: readonly string[],
  selected: readonly string[] = [],
): { keys: string[]; label: (key: string) => string } {
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);
  const { entries } = useTaxonomy('services');

  const keys = useMemo(() => {
    const adminScoped = entries
      .filter((e) => e.active && serviceAppliesTo(e.scope, businessType ?? ''))
      .map((e) => e.key);
    const merged = mergeTaxonomyKeys([...builtInForType, ...adminScoped], entries);
    const held = selected.filter((k) => !merged.includes(k));
    return [...merged, ...held];
  }, [entries, builtInForType.join('|'), businessType, selected.join('|')]);

  const label = useMemo(
    () => taxonomyLabeller('services', entries, t, language),
    [entries, t, language],
  );

  return { keys, label };
}
