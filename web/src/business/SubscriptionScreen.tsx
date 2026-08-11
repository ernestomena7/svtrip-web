// Plan and what it unlocks (feature 007, T108 — FR-038).
//
// Billing is SIMULATED and stays that way. Introducing real payments is a
// governance-level change requiring a constitutional amendment and a security
// review — so selecting a tier writes the choice and no money moves. The note at
// the bottom says so out loud rather than letting the screen imply otherwise.
import { useTranslation } from 'react-i18next';
import {
  SUBSCRIPTION_TIERS,
  TIER_ENTITLEMENTS,
  TIER_PRICE_USD,
  type SubscriptionTier,
} from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useEntitlements } from '@svtrip/core/repos/useEntitlements';
import { selectTier } from '@svtrip/core/repos/subscriptionRepo';
import { Icon } from '@svtrip/core/Icon';
import { Button, Card, Spinner, cx } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';

export function SubscriptionScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { tier, loading } = useEntitlements();

  return (
    <DesktopLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
        {t('subscription.title')}
      </h1>

      {loading ? (
        <Spinner label={t('common.loading')} />
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {SUBSCRIPTION_TIERS.map((option: SubscriptionTier) => {
            const current = option === tier;
            const ent = TIER_ENTITLEMENTS[option];
            return (
              <Card
                key={option}
                className={cx('flex flex-col gap-4 p-6', current && 'ring-2 ring-primary')}
              >
                <div>
                  <p className="eyebrow">{t(`subscription.tiers.${option}`)}</p>
                  <p className="mt-2 font-display text-3xl font-extrabold tabular-nums text-text">
                    ${TIER_PRICE_USD[option]}
                    <span className="text-sm font-bold text-muted">
                      {t('subscription.perMonth')}
                    </span>
                  </p>
                </div>

                {/* Rendered from the entitlements themselves rather than a
                    hand-written list per tier: the two cannot drift apart, and a
                    tier gaining a capability shows up here without an edit. */}
                <ul className="flex-1 space-y-2 text-sm text-muted">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 text-primary">
                      <Icon name="check" size={16} />
                    </span>
                    {t(`subscription.analytics.${ent.analyticsDepth}`)}
                  </li>
                  {ent.rankBoost && (
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">
                        <Icon name="check" size={16} />
                      </span>
                      {t('subscription.featureBoost')}
                    </li>
                  )}
                  {ent.ads && (
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-primary">
                        <Icon name="check" size={16} />
                      </span>
                      {t('subscription.featureAds')}
                    </li>
                  )}
                </ul>

                <Button
                  variant={current ? 'secondary' : 'primary'}
                  disabled={current || !user}
                  onClick={() => user && void selectTier(user.uid, option)}
                >
                  {current ? t('subscription.current') : t('subscription.choose')}
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">{t('subscription.simulatedNote')}</p>
    </DesktopLayout>
  );
}
