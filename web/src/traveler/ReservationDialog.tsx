// Ask a merchant to hold a time, on desktop (feature 020, US2 — FR-006..FR-013).
//
// The desktop twin of `client/src/features/reservations/ReservationSheet.tsx`.
// Per-surface by the standing rule every feature since 008 has followed: one
// `core/` repo, one `shared/` rule set, two presentations. The slot validation
// and the state resolution are NOT duplicated — they live in `shared/`, which
// is what keeps the two surfaces from disagreeing (FR-028).
//
// FR-034 IS THE FIRST THING THIS SCREEN DOES. The button that opens it says
// "Reservar", which promises more than the product delivers — the source
// document's own Supuestos say *"Solicitud, no reserva instantánea"*. So the
// subtitle corrects it in the first line a traveler reads, and the confirmation
// says "Pendiente de confirmación" rather than anything that sounds like a held
// table. Nothing here may describe a reservation as capacity the merchant has
// set aside, because until they answer, it is not.
//
// Three things that look like details and are requirements:
//
//   FR-013  A failed send keeps everything typed. The sheet does not unmount or
//           clear on a rejected promise — it shows the message and leaves the
//           fields exactly as they are. This is a CLIENT obligation; no API can
//           provide it.
//
//   FR-008  A phone given here is remembered — through `saveTravelerPhone`, NOT
//           `saveProfileFields`. The latter stamps `profileVersion`, and 62 of
//           71 live accounts are grandfathered AND incomplete, so stamping them
//           drops them into the mandatory profile form on their next render.
//           That write also must not fail the reservation: remembering a phone
//           is a convenience, the request is what the traveler asked for.
//
//   FR-011  A moment outside the hours is not selectable. Enforced here AND on
//           the server, because a client can post anything.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Place } from '@svtrip/shared';
import { localNow, momentInsideHours } from '@svtrip/shared';
import { Button, Card, Field, TextInput } from '../components/ui';
import { Icon } from '@svtrip/core/Icon';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { createReservation } from '@svtrip/core/apiClient';
import { saveTravelerPhone } from '@svtrip/core/auth/userProfile';

export function ReservationDialog({ place, onClose }: { place: Place; onClose: () => void }) {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  // Prefilled from the profile (FR-007). The phone arrives filled only when the
  // profile holds one — measured 2026-10-13: 0 of 71 do, so for now every
  // traveler types it once and never again.
  const [name, setName] = useState(profile?.displayName ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [people, setPeople] = useState('2');
  const [note, setNote] = useState('');

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const at = date && time ? `${date}T${time}` : '';
  const partySize = Number(people);

  // Named separately so the message can say WHICH rule refused the slot. One
  // combined "invalid" would make a traveler guess between a past time and a
  // closed day.
  const inPast = at !== '' && at <= localNow();
  const outsideHours = at !== '' && !inPast && !momentInsideHours(at, place.openingHours);
  const slotProblem = inPast ? 'slotPast' : outsideHours ? 'slotOutsideHours' : null;

  const complete =
    at !== '' && !slotProblem && name.trim() !== '' && email.trim() !== '' &&
    Number.isInteger(partySize) && partySize >= 1 && partySize <= 50;

  async function send() {
    if (!complete || !user) return;
    setSending(true);
    setError(null);
    try {
      await createReservation({
        listingId: place.placeId,
        at,
        people: partySize,
        note: note.trim() || undefined,
        contactName: name.trim(),
        contactEmail: email.trim(),
        contactPhone: phone.trim() || undefined,
      });
      // FR-008, and it must never fail the reservation that just succeeded.
      if (phone.trim()) {
        try {
          await saveTravelerPhone(user.uid, phone);
        } catch {
          // Deliberately swallowed. The traveler got what they asked for; the
          // only cost is typing the number again next time.
        }
      }
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string }).code;
      // Nothing is cleared and nothing unmounts (FR-013).
      setError(
        code === 'reservations_not_enabled'
          ? 'notEnabled'
          : code === 'listing_not_visible'
            ? 'notVisible'
            : code === 'at_in_past'
              ? 'slotPast'
              : code === 'at_outside_hours'
                ? 'slotOutsideHours'
                : 'sendFailed',
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <Card className="w-full max-w-md space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Icon name="check" size={20} />
            <p className="font-bold">{t('reservations.sent')}</p>
          </div>
          {/* "Pendiente de confirmación", never "Reservado" (FR-034). */}
          <p className="text-sm text-muted">{t('reservations.sentBody')}</p>
          <Button className="w-full" onClick={onClose}>
            {t('common.close')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div className="space-y-1">
          <p className="font-bold">{t('reservations.formTitle')}</p>
          {/* FR-034 in the first line read. */}
          <p className="text-xs text-muted">{t('reservations.formSubtitle')}</p>
        </div>

        <div className="flex gap-3">
          <Field label={t('reservations.date')}>
            {/* `min` keeps yesterday off the picker, which is the accessible
                path as well as the obvious one: a date input enforces it for
                keyboard and screen-reader users without a custom widget. */}
            <TextInput
              type="date"
              value={date}
              min={localNow().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label={t('reservations.time')}>
            <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        {slotProblem && <p className="text-xs text-muted">{t(`reservations.${slotProblem}`)}</p>}

        <Field label={t('reservations.people')}>
          <TextInput
            type="number"
            min={1}
            max={50}
            value={people}
            onChange={(e) => setPeople(e.target.value)}
          />
        </Field>
        {partySize > 50 && <p className="text-xs text-muted">{t('reservations.peopleMax')}</p>}

        <Field label={t('reservations.name')}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('reservations.email')}>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label={t('reservations.phone')}>
          <TextInput
            type="tel"
            value={phone}
            placeholder="+503 7777 7777"
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted">{t('reservations.phoneHelp')}</p>

        <Field label={t('reservations.note')}>
          <TextInput
            value={note}
            placeholder={t('reservations.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {error && <p className="text-sm text-muted">{t(`reservations.${error}`)}</p>}

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={sending}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" onClick={send} disabled={!complete || sending}>
            {sending ? t('reservations.sending') : t('reservations.send')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
