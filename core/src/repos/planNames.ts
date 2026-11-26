// Feature 025 (T029a, H1/FR-004): ONE name per plan, wherever the product shows it.
//
// The plan names live in data (`subscription_plans.name_i18n`, editable without a release — feature 018
// FR-001), but every screen rendered them from the locale key `subscription.plans.<code>` — and five
// sentences wrote "Básico" into their prose. So renaming Básico to "Standard" in data would have made
// the public page say Standard and the app say Básico, the split FR-004 forbids. Every place that names
// a plan now asks this hook: the stored name when there is one, the locale key otherwise.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SubscriptionPlanConfig } from '@svtrip/shared';
import { fetchPlans } from '../apiClient';
import { useUiStore } from '../uiStore';

let pending: Promise<SubscriptionPlanConfig[]> | null = null;
let loaded: SubscriptionPlanConfig[] | null = null;

function loadPlans(): Promise<SubscriptionPlanConfig[]> {
  if (!pending) {
    pending = Promise.resolve()
      .then(() => fetchPlans())
      .then((c) => (loaded = c.plans))
      .catch(() => {
        pending = null; // a later screen may try again; until then the locale name stands
        return [];
      });
  }
  return pending;
}

/** For tests: forget the cached catalog. */
export function resetPlanNames(): void {
  pending = null;
  loaded = null;
}

/** `(code) => display name` — the stored name in the current language, else the locale key. */
export function usePlanName(): (code: string) => string {
  const { t } = useTranslation();
  const language = useUiStore((s) => s.language);
  const [plans, setPlans] = useState<SubscriptionPlanConfig[] | null>(loaded);

  useEffect(() => {
    let alive = true;
    void loadPlans().then((p) => alive && setPlans(p));
    return () => {
      alive = false;
    };
  }, []);

  return (code: string) => plans?.find((p) => p.code === code)?.nameI18n?.[language]?.trim() || t(`subscription.plans.${code}`);
}
