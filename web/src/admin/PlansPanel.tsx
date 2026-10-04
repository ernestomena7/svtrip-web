// Plan administration (feature 018, FR-021/FR-036). Web only, super admin only.
//
// A SIBLING PANEL, NOT A `VocabularyPanel`. Research R5 settled this: that
// component renders key/label/active rows, and a plan has a price, a launch
// discount and an entitlement set. Forcing a plan into the vocabulary shape
// would either break that component's contract or produce a plan that cannot
// express a price.
//
// What IS reused: the screen, the `useSuperAdmin` gate, the BFF-mediated write
// pattern, and `write: if false` in the rules — the feature 010 idiom, applied
// for the third time.
//
// WHY THIS PANEL IS NOT A CONVENIENCE: there is no payment gateway, so
// `paymentActive` is never set by anything. These controls are the only way a
// subscription reaches `active` in production, which is why US5 is P2.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { COMMERCIAL_PLANS, type PlanCode, type SubscriptionState } from '@svtrip/shared';
import { getJson, patchJson, putJson } from '@svtrip/core/apiClient';
import { Button, Card, Field, Spinner, TextInput, cx } from '../components/ui';

interface PlanRow {
  code: PlanCode;
  monthlyPriceUsd: number;
  launchDiscountPercent: number;
  updatedBy?: string;
  updatedAt?: number;
}

interface SubscriptionRow {
  uid: string;
  subscription: {
    planCode: PlanCode;
    paymentActive: boolean;
    campaignEndsAt?: number;
    graceEndsAt?: number;
    manualBy?: string;
    manualNote?: string;
  };
  state: SubscriptionState;
  placeCount: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function PlansPanel() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [rows, setRows] = useState<SubscriptionRow[] | null>(null);
  const [campaignOpen, setCampaignOpen] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function reload() {
    setError(false);
    try {
      const [cat, list] = await Promise.all([
        getJson<{ plans: PlanRow[]; campaign: { launchAt?: number } }>('/subscriptions/plans'),
        getJson<{ rows: SubscriptionRow[] }>('/admin/subscriptions'),
      ]);
      setPlans(cat.plans);
      setCampaignOpen(cat.campaign.launchAt);
      setRows(list.rows);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function savePrice(code: PlanCode, price: number) {
    setBusy(true);
    try {
      await patchJson(`/admin/plans/${code}`, { monthlyPriceUsd: price });
      await reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function setLaunch(at: number | null) {
    setBusy(true);
    try {
      await putJson('/admin/launch-campaign', { launchAt: at });
      await reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function patchSubscription(uid: string, body: Record<string, unknown>) {
    // FR-021: the reason is asked for HERE too, not only validated server-side.
    // A panel that lets you act and then rejects you has made you type
    // everything twice.
    const note = window.prompt(t('admin.plans.notePrompt') ?? '');
    if (!note || !note.trim()) return;
    setBusy(true);
    try {
      await patchJson(`/admin/subscriptions/${uid}`, { ...body, note });
      await reload();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Card className="mt-6 p-6">
        <p className="text-sm font-bold text-primary">{t('common.somethingWrong')}</p>
        <Button variant="secondary" className="mt-3" onClick={() => void reload()}>
          {t('common.retry')}
        </Button>
      </Card>
    );
  }

  if (!plans || !rows) {
    return (
      <div className="mt-6">
        <Spinner label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* --- Prices: FR-001, changeable without a release --- */}
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg font-extrabold text-text">
          {t('admin.plans.pricesTitle')}
        </h2>
        {/* US5 scenario 3: a price change applies GOING FORWARD. There is no
            per-subscription price to update, so nobody's current period is
            retroactively repriced — the property holds by construction. */}
        <p className="text-sm text-muted">{t('admin.plans.pricesHint')}</p>
        {plans
          .filter((p) => (COMMERCIAL_PLANS as readonly string[]).includes(p.code))
          .map((p) => (
            <PriceRow key={p.code} plan={p} busy={busy} onSave={savePrice} />
          ))}
      </Card>

      {/* --- The campaign window: FR-048/FR-049 --- */}
      <Card className="space-y-3 p-6">
        <h2 className="font-display text-lg font-extrabold text-text">
          {t('admin.plans.campaignTitle')}
        </h2>
        <p className="text-sm text-muted">
          {campaignOpen === undefined
            ? t('admin.plans.campaignClosed')
            : t('admin.plans.campaignOpen', {
                date: new Date(campaignOpen).toLocaleDateString(),
              })}
        </p>
        <div className="flex gap-3">
          <Button disabled={busy} onClick={() => void setLaunch(Date.now())}>
            {t('admin.plans.openWindow')}
          </Button>
          {/* Closing it again is the only way to undo an accidental open, which
              is why `null` is a meaningful value rather than "no change". */}
          <Button variant="secondary" disabled={busy} onClick={() => void setLaunch(null)}>
            {t('admin.plans.closeWindow')}
          </Button>
        </div>
      </Card>

      {/* --- One merchant at a time: FR-021 --- */}
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg font-extrabold text-text">
          {t('admin.plans.subscriptionsTitle')}
        </h2>
        {rows.length === 0 && <p className="text-sm text-muted">{t('admin.plans.noneYet')}</p>}
        {rows.map((row) => (
          <div
            key={row.uid}
            className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-muted">{row.uid}</p>
              <p className="text-sm font-bold text-text">
                {row.subscription.planCode} · {t(`subscription.states.${row.state}`)} ·{' '}
                {t('admin.plans.places', { count: row.placeCount })}
              </p>
              {row.subscription.manualNote && (
                // SC-009: the actor and the reason are both readable afterwards.
                <p className="mt-0.5 text-xs text-muted">
                  {t('admin.plans.lastManual', {
                    by: row.subscription.manualBy ?? '?',
                    note: row.subscription.manualNote,
                  })}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void patchSubscription(row.uid, { paymentActive: true })}
              >
                {t('admin.plans.activate')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void patchSubscription(row.uid, {
                    campaignEndsAt: (row.subscription.campaignEndsAt ?? Date.now()) + 15 * DAY,
                  })
                }
              >
                {t('admin.plans.extend15')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void patchSubscription(row.uid, { paymentActive: false })}
              >
                {t('admin.plans.deactivate')}
              </Button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function PriceRow({
  plan,
  busy,
  onSave,
}: {
  plan: PlanRow;
  busy: boolean;
  onSave: (code: PlanCode, price: number) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [value, setValue] = useState(String(plan.monthlyPriceUsd));
  const parsed = Number(value);
  // Refused in the UI as well as in the service: Decision 1 of the source
  // document is that no free plan exists.
  const valid = Number.isFinite(parsed) && parsed > 0;

  return (
    <div className="flex items-end gap-3">
      <Field label={t(`subscription.plans.${plan.code}`)}>
        <TextInput inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      <Button
        className={cx(!valid && 'opacity-50')}
        disabled={busy || !valid || parsed === plan.monthlyPriceUsd}
        onClick={() => void onSave(plan.code, parsed)}
      >
        {t('common.save')}
      </Button>
    </div>
  );
}
