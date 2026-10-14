// "Mis reservas", on desktop (feature 020, US2 — FR-014, FR-015, FR-023).
//
// The twin of `client/src/features/reservations/MyReservationsScreen.tsx`.
// The SPLIT is not duplicated — `useMyReservations` in `core/` does it from
// `shared/`'s resolver, which is what keeps the two surfaces from disagreeing
// about whether a reservation is upcoming (FR-028, and feature 014's still-live
// desktop Discover defect is what that requirement exists to prevent).
//
// FR-014 IS THE REASON THIS SCREEN IS REACHABLE WITH NOTHING IN IT. The entry
// point on the profile is always there, whether or not the traveler has a single
// reservation — an entry point that appears only once it is useful cannot be
// found by somebody looking for it, which is the gap feature 009 found on `web/`
// for moods and feature 011 found again for the profile fields.
//
// THE SPLIT READS THE DERIVED STATE, NOT `recorded` (FR-028a). A reservation
// whose moment has passed belongs in Pasadas as Expirada or Completada even
// though nothing was written when it got there — this product has no cron, no
// scheduled function and no job, measured at feature 018. Split on `recorded`
// instead and every lapsed request would sit in Próximas forever, looking like
// something still to come.
//
// Loading, empty and error states are acceptance criteria under Constitution
// Principle V, not polish. This is a live Firestore subscription, so the loading
// moment is real — feature 018 captured `business-subscription` as a spinner in
// its visual baseline for exactly this reason.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { reservationLabelKey } from '@svtrip/shared';
import type { ReservationState } from '@svtrip/shared';
import { Button, Card, Spinner, ErrorState } from '../components/ui';
import { Icon } from '@svtrip/core/Icon';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useMyReservations, type ResolvedReservation } from '@svtrip/core/repos/reservationsRepo';
import { cancelReservation } from '@svtrip/core/apiClient';

/** A reservation's state, in the vocabulary this side of it uses (FR-029). */
function StateLabel({ state }: { state: ReservationState }) {
  const { t } = useTranslation();
  return <span className="text-xs text-muted">{t(reservationLabelKey(state, 'traveler'))}</span>;
}

function ReservationRow({
  reservation,
  onCancel,
}: {
  reservation: ResolvedReservation;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [date, time] = reservation.at.split('T');
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="font-bold">
            {date} · {time}
          </p>
          <p className="text-xs text-muted">
            {reservation.people === 1
              ? t('reservations.forOnePerson')
              : t('reservations.forPeople', { count: reservation.people })}
          </p>
        </div>
        <StateLabel state={reservation.state} />
      </div>
      {/* The merchant's own words, when they wrote any (FR-020). */}
      {reservation.rejectionMessage && (
        <p className="rounded-md bg-surface-2 p-2 text-xs">{reservation.rejectionMessage}</p>
      )}
      {/* Offered only while it can still be cancelled. A lapsed reservation
          shows no control rather than one that fails — the server refuses it
          with 409 `elapsed`, and a button that exists to be refused is the thing
          FR-003's "absent, not disabled" rules out elsewhere on this screen. */}
      {onCancel && (
        <Button variant="secondary" className="w-full" onClick={onCancel}>
          {t('reservations.cancel')}
        </Button>
      )}
    </Card>
  );
}

export function MyReservationsScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { upcoming, past, loading, error } = useMyReservations(user?.uid);

  // FR-023: asked to confirm FIRST. Held as the reservation being cancelled
  // rather than a boolean, so the prompt cannot end up pointing at a different
  // row than the one tapped.
  const [confirming, setConfirming] = useState<ResolvedReservation | null>(null);
  const [cancelError, setCancelError] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function doCancel() {
    if (!confirming) return;
    setCancelling(true);
    setCancelError(false);
    try {
      await cancelReservation(confirming.reservationId);
      setConfirming(null);
    } catch {
      // FR-022's sibling: the row keeps its previous state and the message says
      // so. The live subscription has not changed, so nothing on screen moved.
      setCancelError(true);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Spinner label={t('reservations.loading')} />;
  if (error) return <ErrorState message={t('reservations.loadFailed')} />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-bold">{t('reservations.myTitle')}</h1>

      {upcoming.length === 0 && past.length === 0 && (
        <Card className="space-y-2 p-5 text-center">
          <Icon name="calendar" size={24} />
          <p className="font-bold">{t('reservations.emptyTitle')}</p>
          <p className="text-sm text-muted">{t('reservations.emptyBody')}</p>
          <Button className="w-full" onClick={() => navigate('/discover')}>
            {t('discover.title')}
          </Button>
        </Card>
      )}

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted">{t('reservations.upcoming')}</h2>
          {upcoming.map((r) => (
            <ReservationRow
              key={r.reservationId}
              reservation={r}
              onCancel={() => setConfirming(r)}
            />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-muted">{t('reservations.past')}</h2>
          {past.map((r) => (
            <ReservationRow key={r.reservationId} reservation={r} />
          ))}
        </section>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-3 p-6">
            <p className="font-bold">{t('reservations.cancelConfirm')}</p>
            <p className="text-sm text-muted">{t('reservations.cancelConfirmBody')}</p>
            {cancelError && <p className="text-sm text-muted">{t('reservations.cancelFailed')}</p>}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirming(null)}
                disabled={cancelling}
              >
                {t('reservations.cancelKeep')}
              </Button>
              <Button className="flex-1" onClick={doCancel} disabled={cancelling}>
                {t('reservations.cancel')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
