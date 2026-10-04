// Merchant plans, desktop (feature 018, US1 + FR-022). Parity with
// `client/src/features/provider/SubscriptionScreen.tsx`.
//
// REWRITTEN from the three-tier screen. The header of the old version said
// "Billing is SIMULATED and stays that way. Introducing real payments is a
// governance-level change requiring a constitutional amendment and a security
// review" — which was exactly right, and feature 018 is the feature that
// triggers it. FR-046 amends that clause and FR-047 records the review; what
// does NOT change is that nothing is charged here (FR-042), and the note at the
// bottom still says so out loud rather than letting the screen imply otherwise.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  COMMERCIAL_PLANS,
  PLAN_ENTITLEMENTS,
  priceInEffect,
  type CommercialPlanCode,
  type SubscriptionState,
} from '@svtrip/shared';
import { useEntitlements } from '@svtrip/core/repos/useEntitlements';
import {
  cancelSubscription,
  changeSubscriptionPlan,
  chooseSubscriptionPlan,
  fetchPlanCatalog,
  type PlanCatalog,
} from '@svtrip/core/repos/subscriptionRepo';
import { Icon, type IconName } from '@svtrip/core/Icon';
import { Badge, Button, Card, ErrorState, Spinner, cx, type BadgeTone } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';

const RECOMMENDED: CommercialPlanCode = 'premium';

/** The matrix rows, in the spec's order. Same list as the mobile screen. */
const ROWS: Array<{ key: string; has: (p: CommercialPlanCode) => boolean }> = [
  { key: 'catalogVisible', has: (p) => PLAN_ENTITLEMENTS[p].catalogVisible },
  { key: 'selfService', has: (p) => PLAN_ENTITLEMENTS[p].selfService },
  { key: 'ownProfilePromotions', has: (p) => PLAN_ENTITLEMENTS[p].ownProfilePromotions },
  { key: 'basicMetrics', has: (p) => PLAN_ENTITLEMENTS[p].basicMetrics },
  { key: 'rankBoost', has: (p) => PLAN_ENTITLEMENTS[p].rankBoost },
  { key: 'offersPublishing', has: (p) => PLAN_ENTITLEMENTS[p].offersPublishing },
  { key: 'expandedMetrics', has: (p) => PLAN_ENTITLEMENTS[p].expandedMetrics },
];

const STATE_STYLE: Record<SubscriptionState, { tone: BadgeTone; icon: IconName }> = {
  campaign: { tone: 'promo', icon: 'sparkles' },
  active: { tone: 'live', icon: 'check' },
  grace: { tone: 'attention', icon: 'clock' },
  pending_payment: { tone: 'attention', icon: 'clock' },
  cancelled: { tone: 'off', icon: 'clock' },
  suspended: { tone: 'off', icon: 'minus' },
};

export function SubscriptionScreen() {
  const { t, i18n } = useTranslation();
  const { planCode, state, subscription, loading, managedPlaceIds, coveredPlaceIds } =
    useEntitlements();
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [saving, setSaving] = useState<CommercialPlanCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [choosing, setChoosing] = useState(false);


  useEffect(() => {
    let alive = true;
    fetchPlanCatalog()
      .then((c) => alive && setCatalog(c))
      .catch(() => alive && setError('load'));
    return () => {
      alive = false;
    };
  }, []);

  const priceOf = useMemo(
    () => (code: CommercialPlanCode) => {
      const full = catalog?.plans.find((p) => p.code === code)?.monthlyPriceUsd ?? 0;
      const windowOpen = catalog?.campaign.launchAt !== undefined;
      return { full, campaign: priceInEffect(code, full, windowOpen) };
    },
    [catalog],
  );

  async function pick(code: CommercialPlanCode, coveredPlaceId?: string) {
    setSaving(code);
    setError(null);
    try {
      if (subscription) await changeSubscriptionPlan(code, coveredPlaceId);
      else await chooseSubscriptionPlan(code, coveredPlaceId);
      setChoosing(false);
    } catch (err) {
      const c = (err as { code?: string }).code;
      // The 409 is not an error to apologise for — it is the product asking a
      // question it refuses to answer for the merchant.
      if (c === 'choose_covered_place') setChoosing(true);
      else setError('generic');
    } finally {
      setSaving(null);
    }
  }

  async function doCancel() {
    setSaving('basico');
    setError(null);
    try {
      await cancelSubscription();
      setCancelling(false);
    } catch {
      setError('generic');
    } finally {
      setSaving(null);
    }
  }


  return (
    <DesktopLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
        {t('subscription.title')}
      </h1>

      {error === 'load' && (
        <div className="mt-6">
          <ErrorState message={t('common.somethingWrong')} />
        </div>
      )}

      {error && error !== 'load' && (
        <p className="mt-6 rounded-md bg-surface-2 px-3.5 py-2.5 text-sm font-bold text-primary">
          {error === 'chooseCoveredPlace'
            ? t('subscription.chooseCoveredPlace')
            : t('common.somethingWrong')}
        </p>
      )}

      {/* FR-022 / SC-004: plan, state, what they pay now, what they pay later. */}
      {subscription && state && (
        <Card className="mt-6 flex flex-col gap-2 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-lg font-extrabold text-text">
              {t(`subscription.plans.${subscription.planCode}`)}
            </h2>
            <Badge tone={STATE_STYLE[state].tone} icon={STATE_STYLE[state].icon}>
              {t(`subscription.states.${state}`)}
            </Badge>
          </div>
          <div className="text-sm md:text-right">
            <p className="font-bold text-text">
              {t('subscription.payingNow', {
                amount: priceOf(subscription.planCode as CommercialPlanCode).campaign.toFixed(2),
              })}
            </p>
            {subscription.campaignEndsAt !== undefined && (
              <p className="text-muted">
                {t('subscription.thenFrom', {
                  amount: priceOf(subscription.planCode as CommercialPlanCode).full.toFixed(2),
                  date: new Date(subscription.campaignEndsAt).toLocaleDateString(i18n.language, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                })}
              </p>
            )}
            {managedPlaceIds.length > 1 && (
              <p className="text-xs text-muted">
                {t('subscription.coversCount', {
                  covered: coveredPlaceIds.length,
                  total: managedPlaceIds.length,
                })}
              </p>
            )}
          </div>
        </Card>
      )}

      {loading && !catalog ? (
        <div className="mt-8">
          <Spinner label={t('common.loading')} />
        </div>
      ) : (
        // Two plans, so two columns rather than the three the tier model used.
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {catalog &&
            COMMERCIAL_PLANS.map((code) => {
              const current = code === planCode;
              const isRecommended = code === RECOMMENDED;
              const { full, campaign } = priceOf(code);
              const discounted = campaign !== full;
              return (
                <Card
                  key={code}
                  className={cx(
                    'relative flex flex-col gap-4 p-6',
                    current && 'ring-2 ring-primary',
                    !current && isRecommended && 'ring-[1.5px] ring-accent',
                  )}
                >
                  {isRecommended && (
                    <Badge tone="promo" className="absolute -top-3 left-6">
                      {t('subscription.recommended')}
                    </Badge>
                  )}

                  <div>
                    <p className="eyebrow">{t(`subscription.plans.${code}`)}</p>
                    <p className="mt-2 font-display text-3xl font-extrabold tabular-nums text-text">
                      ${campaign.toFixed(2)}
                      <span className="text-sm font-bold text-muted">
                        {t('subscription.perMonth')}
                      </span>
                    </p>
                    {discounted && (
                      <p className="text-sm font-bold text-muted">
                        <span className="line-through">${full.toFixed(2)}</span>{' '}
                        <span className="text-accent">{t('subscription.campaignEyebrow')}</span>
                      </p>
                    )}
                  </div>

                  {/* Rendered from the entitlements table rather than a
                      hand-written list per plan: the two cannot drift apart,
                      and a plan gaining a capability shows up here with no
                      edit. Kept from the version this replaces. */}
                  <ul className="flex-1 space-y-2 text-sm">
                    {ROWS.map((row) => {
                      const included = row.has(code);
                      return (
                        <li
                          key={row.key}
                          className={cx(
                            'flex items-start gap-2',
                            included ? 'text-text' : 'text-muted',
                          )}
                        >
                          <span className={cx('mt-0.5', included ? 'text-primary' : 'text-border')}>
                            <Icon name={included ? 'check' : 'minus'} size={16} />
                          </span>
                          {t(`subscription.features.${row.key}`)}
                        </li>
                      );
                    })}
                  </ul>

                  <Button
                    variant={current ? 'secondary' : 'primary'}
                    disabled={current || saving !== null}
                    onClick={() => void pick(code)}
                  >
                    {current
                      ? t('subscription.current')
                      : saving === code
                        ? t('common.loading')
                        : t('subscription.choose', { plan: t(`subscription.plans.${code}`) })}
                  </Button>
                </Card>
              );
            })}
        </div>
      )}


        {/* US4 scenario 1b: the product does NOT choose. A Premium account with
            three places stepping down to Básico says which one it keeps —
            guessing would hide two places on a supposition. */}
        {choosing && (
          <Card className="space-y-3 p-5">
            <h2 className="font-display text-base font-extrabold text-text">
              {t('subscription.coveredPlaceTitle')}
            </h2>
            <p className="text-sm text-muted">{t('subscription.coveredPlaceHint')}</p>
            <div className="space-y-2">
              {managedPlaceIds.map((id) => (
                <Button
                  key={id}
                  variant="secondary"
                  className="w-full"
                  disabled={saving !== null}
                  onClick={() => void pick('basico', id)}
                >
                  {id}
                </Button>
              ))}
            </div>
            <Button variant="ghost" className="w-full" onClick={() => setChoosing(false)}>
              {t('subscription.keepPlan')}
            </Button>
          </Card>
        )}

        {/* Confirmed rather than instant: nothing is deleted, but the place
            stops being shown, which is destructive in effect. Same shape as the
            Trip deletion feature 016 added. */}
        {subscription && state !== 'cancelled' && state !== 'suspended' && (
          cancelling ? (
            <Card className="space-y-3 p-5">
              <p className="text-sm text-muted">{t('subscription.cancelConfirm')}</p>
              <Button
                variant="primary"
                className="w-full"
                disabled={saving !== null}
                onClick={() => void doCancel()}
              >
                {t('subscription.cancelAction')}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setCancelling(false)}>
                {t('subscription.keepPlan')}
              </Button>
            </Card>
          ) : (
            <Button variant="ghost" className="w-full" onClick={() => setCancelling(true)}>
              {t('subscription.cancelPlan')}
            </Button>
          )
        )}

      <p className="mt-6 text-xs text-muted">{t('subscription.noChargeYet')}</p>
    </DesktopLayout>
  );
}
