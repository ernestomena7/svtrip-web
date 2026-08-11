// Claim a catalog entry (feature 007, T107 — FR-037).
//
// THE RULE THAT MATTERS: filing a claim NEVER grants ownership. Read literally,
// "the business claims its entry" would let the first account to ask become the
// manager of El Tunco. Ownership moves only through the BFF with an operator
// approval — and because every catalog entry already has a manager, *handover*
// is the only path a real business can use today.
//
// So this screen files a request and says so. It must never imply the entry is
// now theirs, and it must show the request's real state rather than optimism.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BusinessClaim, Place } from '@svtrip/shared';
import { resolveLocalized } from '@svtrip/shared';
import { useUiStore } from '@svtrip/core/uiStore';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { fetchPlaces } from '@svtrip/core/repos/discoverRepo';
import { fileClaim, pendingClaimFor, subscribeToMyClaims, withdrawClaim } from '@svtrip/core/repos/claimsRepo';
import { Button, Card, EmptyState, SearchInput, Spinner, TextArea, cx } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';

export function ClaimBusinessScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const language = useUiStore((s) => s.language);

  const [places, setPlaces] = useState<Place[] | null>(null);
  const [claims, setClaims] = useState<BusinessClaim[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Place | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPlaces()
      .then((p) => !cancelled && setPlaces(p))
      .catch(() => !cancelled && setPlaces([]));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToMyClaims(user.uid, setClaims);
  }, [user]);

  const matches = (places ?? []).filter((place) => {
    if (!query.trim()) return false;
    const name = resolveLocalized(place.name, place.nameI18n, language).toLowerCase();
    return name.includes(query.trim().toLowerCase());
  });

  async function file() {
    if (!selected) return;
    setBusy(true);
    try {
      await fileClaim(selected.placeId, message.trim() || undefined);
      setSelected(null);
      setMessage('');
      setQuery('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DesktopLayout>
      <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
        {t('claims.title')}
      </h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">{t('claims.claimExplain')}</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SearchInput
            label={t('claims.searchLabel')}
            placeholder={t('claims.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {places === null && <Spinner label={t('common.loading')} />}

          {places !== null && query.trim() !== '' && matches.length === 0 && (
            <EmptyState icon="search" title={t('search.noResults')} />
          )}

          <ul className="space-y-2">
            {matches.slice(0, 12).map((place) => {
              const pending = pendingClaimFor(claims, place.placeId);
              return (
                <li key={place.placeId}>
                  <Card
                    className={cx(
                      'flex flex-wrap items-center gap-3 p-4',
                      selected?.placeId === place.placeId && 'ring-2 ring-primary',
                    )}
                  >
                    <span className="font-bold text-text">
                      {resolveLocalized(place.name, place.nameI18n, language)}
                    </span>
                    {pending ? (
                      <span className="ml-auto rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-extrabold text-muted">
                        {t('claims.pending')}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="ml-auto"
                        onClick={() => setSelected(place)}
                      >
                        {t('claims.claimCta')}
                      </Button>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {selected ? (
            <Card className="space-y-3 p-5">
              <p className="font-display text-base font-extrabold text-text">
                {resolveLocalized(selected.name, selected.nameI18n, language)}
              </p>
              {/* An entry that already has a manager is a HANDOVER, and the copy
                  has to say so — the two are different requests with different
                  consequences for the business currently in charge. */}
              <p className="text-sm text-muted">
                {selected.ownerUid ? t('claims.handoverExplain') : t('claims.claimExplain')}
              </p>
              <TextArea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('claims.messagePlaceholder')}
              />
              <Button fullWidth disabled={busy} onClick={() => void file()}>
                {busy ? t('common.loading') : t('claims.send')}
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setSelected(null)}>
                {t('common.close')}
              </Button>
              <p className="text-xs text-muted">{t('claims.approvalNotice')}</p>
            </Card>
          ) : (
            <Card className="p-5">
              <p className="text-sm text-muted">{t('claims.selectHint')}</p>
            </Card>
          )}

          {claims.length > 0 && (
            <Card className="space-y-3 p-5">
              <p className="font-display text-base font-extrabold text-text">
                {t('claims.mineTitle')}
              </p>
              <ul className="space-y-2">
                {claims.map((claim) => (
                  <li key={claim.claimId} className="flex items-center gap-2 text-sm">
                    <span className="truncate text-text">{claim.listingName ?? claim.listingId}</span>
                    <span className="ml-auto rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-extrabold text-muted">
                      {t(`claims.status.${claim.status}`)}
                    </span>
                    {claim.status === 'pending' && (
                      <Button size="sm" variant="ghost" onClick={() => void withdrawClaim(claim.claimId)}>
                        {t('claims.withdraw')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </DesktopLayout>
  );
}
