// The merchant answers, on desktop (feature 020, US3 — FR-017..FR-022).
//
// The twin of `client/src/features/provider/ReservationsInbox.tsx`. The GROUPING
// is not duplicated — `useReservationInbox` in `core/` derives it from
// `shared/`'s resolver, so the two surfaces cannot disagree about which tab a
// request belongs in (FR-028).
//
// SC-002 IS TWO TAPS, and that shapes the whole screen: Confirmar and Rechazar
// sit on the CARD, so answering never requires opening a detail first (FR-021).
// Rejecting with a reason is a second screen; rejecting without one is one tap
// from the list, because FR-020 says both the reason and the message are
// optional — twice. Requiring a reason "so the traveler knows why" would turn a
// two-tap answer into a form, which is exactly what SC-002 measures.
//
// THE THREE GROUPS READ THE DERIVED STATE, NOT `recorded` (FR-028a). A request
// whose moment has passed falls into Historial by itself. Grouped on `recorded`
// instead, every lapsed request would sit in Pendientes forever and the pending
// count would keep climbing with work nobody can do.
//
// FR-022: a failed answer leaves the request in its PREVIOUS state. The live
// subscription has not changed, so nothing on screen moves — the message says so
// and the card stays where it was. 018's `ClaimQueueScreen` is the cautionary
// tale in the other direction: a warning there did not merely display, it kept
// the card in the queue.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { reservationLabelKey } from '@svtrip/shared';
import { Button, Card, Field, Spinner, ErrorState, TextInput } from '../components/ui';
import { Icon } from '@svtrip/core/Icon';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useReservationInbox, type ResolvedReservation } from '@svtrip/core/repos/reservationsRepo';
import { confirmReservation, rejectReservation } from '@svtrip/core/apiClient';

/** The closed set FR-020 allows. Keys, never sentences — feature 012's rule. */
const REASONS = ['full', 'closed', 'tooSoon', 'other'] as const;

type Tab = 'pending' | 'confirmed' | 'history';

function RequestCard({
  reservation,
  onConfirm,
  onReject,
  answering,
}: {
  reservation: ResolvedReservation;
  onConfirm?: () => void;
  onReject?: () => void;
  answering?: boolean;
}) {
  const { t } = useTranslation();
  const [date, time] = reservation.at.split('T');
  // FR-024/FR-026: the phone is on a document only these two uids can read, so
  // showing it here needs no projection — the access rule IS the protection.
  const waLink = reservation.contactPhone
    ? `https://wa.me/${reservation.contactPhone.replace(/[^\d]/g, '')}`
    : null;

  return (
    <Card className="space-y-3 p-4">
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
        <span className="text-xs text-muted">
          {t(reservationLabelKey(reservation.state, 'merchant'))}
        </span>
      </div>

      {/* FR-018 scenario 3: the detail is on the card rather than behind it.
          There is nothing here worth a second screen, and a merchant answering
          five requests should not open five. */}
      <div className="space-y-0.5 text-xs">
        <p className="font-bold">{reservation.contactName}</p>
        <p className="text-muted">{reservation.contactEmail}</p>
        {reservation.contactPhone && <p className="text-muted">{reservation.contactPhone}</p>}
      </div>
      {reservation.note && (
        <p className="rounded-md bg-surface-2 p-2 text-xs">{reservation.note}</p>
      )}

      {/* ABSENT when the traveler left no phone, never present-and-broken
          (FR-009, US3 scenario 4). A WhatsApp button that opens nothing is worse
          than no button. */}
      {waLink && (
        <a
          href={waLink}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-xs font-bold text-primary"
        >
          <Icon name="send" size={14} />
          {t('reservations.merchant.whatsapp')}
        </a>
      )}

      {onConfirm && onReject && (
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onReject} disabled={answering}>
            {t('reservations.merchant.reject')}
          </Button>
          <Button className="flex-1" onClick={onConfirm} disabled={answering}>
            {t('reservations.merchant.confirm')}
          </Button>
        </div>
      )}
    </Card>
  );
}

export function ReservationsInbox() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pending, confirmed, history, loading, error } = useReservationInbox(user?.uid);

  const [tab, setTab] = useState<Tab>('pending');
  const [rejecting, setRejecting] = useState<ResolvedReservation | null>(null);
  const [reason, setReason] = useState<string>('');
  const [message, setMessage] = useState('');
  const [answering, setAnswering] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  async function confirm(r: ResolvedReservation) {
    setAnswering(true);
    setAnswerError(null);
    try {
      await confirmReservation(r.reservationId);
    } catch (err) {
      // The card does not move. The subscription is the source of truth and it
      // has not changed, so FR-022 holds by construction rather than by us
      // putting it back.
      const code = (err as { code?: string }).code;
      setAnswerError(code === 'elapsed' ? 'elapsed' : 'answerFailed');
    } finally {
      setAnswering(false);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setAnswering(true);
    setAnswerError(null);
    try {
      // BOTH optional, and a call with neither must go through.
      await rejectReservation(rejecting.reservationId, {
        reason: reason || undefined,
        message: message.trim() || undefined,
      });
      setRejecting(null);
      setReason('');
      setMessage('');
    } catch (err) {
      const code = (err as { code?: string }).code;
      setAnswerError(code === 'elapsed' ? 'elapsed' : 'answerFailed');
    } finally {
      setAnswering(false);
    }
  }

  if (loading) return <Spinner label={t('reservations.merchant.loading')} />;
  if (error) return <ErrorState message={t('reservations.merchant.loadFailed')} />;

  const shown = tab === 'pending' ? pending : tab === 'confirmed' ? confirmed : history;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-bold">{t('reservations.merchant.inboxTitle')}</h1>

      <div className="flex gap-2">
        {(
          [
            ['pending', 'pendingTab', pending.length],
            ['confirmed', 'confirmedTab', confirmed.length],
            ['history', 'historyTab', history.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={
              tab === key
                ? 'rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white'
                : 'rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold text-muted'
            }
          >
            {t(`reservations.merchant.${label}`)} {count}
          </button>
        ))}
      </div>

      {answerError && (
        <p className="text-sm text-muted">{t(`reservations.merchant.${answerError}`)}</p>
      )}

      {shown.length === 0 ? (
        <Card className="space-y-2 p-5 text-center">
          <Icon name="calendar" size={24} />
          <p className="font-bold">{t('reservations.merchant.emptyTitle')}</p>
          <p className="text-sm text-muted">{t('reservations.merchant.emptyBody')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <RequestCard
              key={r.reservationId}
              reservation={r}
              answering={answering}
              onConfirm={tab === 'pending' ? () => void confirm(r) : undefined}
              onReject={tab === 'pending' ? () => setRejecting(r) : undefined}
            />
          ))}
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-3 p-6">
            <p className="font-bold">{t('reservations.merchant.rejectTitle')}</p>

            <Field label={t('reservations.merchant.rejectReason')}>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(reason === r ? '' : r)}
                    aria-pressed={reason === r}
                    className={
                      reason === r
                        ? 'rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white'
                        : 'rounded-full bg-surface-2 px-3 py-1.5 text-xs font-bold text-muted'
                    }
                  >
                    {t(`reservations.merchant.reason.${r}`)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={t('reservations.merchant.rejectMessage')}>
              <TextInput
                value={message}
                placeholder={t('reservations.merchant.rejectMessagePlaceholder')}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>

            {answerError && (
              <p className="text-sm text-muted">{t(`reservations.merchant.${answerError}`)}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setRejecting(null)}
                disabled={answering}
              >
                {t('common.cancel')}
              </Button>
              {/* NOT disabled on an empty reason or message. Both are optional
                  (FR-020), and this button is the whole of that requirement. */}
              <Button className="flex-1" onClick={reject} disabled={answering}>
                {t('reservations.merchant.rejectSend')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/** The pending count, for the merchant's own profile (FR-017). */
export function ReservationRequestsCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pendingCount } = useReservationInbox(user?.uid);

  return (
    <button type="button" className="w-full text-left" onClick={onOpen}>
      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="font-bold">{t('reservations.merchant.inboxCard')}</p>
          <p className="text-xs text-muted">
            {pendingCount === 1
              ? t('reservations.merchant.pendingCountOne')
              : t('reservations.merchant.pendingCount', { count: pendingCount })}
          </p>
        </div>
        <Icon name="arrow-right" size={18} />
      </Card>
    </button>
  );
}
