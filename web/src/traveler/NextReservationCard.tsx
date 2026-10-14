// The nearest upcoming reservation, as a card for Explorar (feature 020, FR-016).
//
// **ITS OWN MODULE, AND THAT IS NOT TIDINESS.** It began inside
// `MyReservationsScreen.tsx`, and importing it into `DiscoverScreen` broke TWO
// existing test suites — `DiscoverScreen.test.tsx` and `SearchField.test.tsx` —
// with `auth/invalid-api-key`. That screen imports `cancelReservation` from
// `core/apiClient`, which imports `core/firebase`, which calls `getAuth()` at
// module scope and initialises a real Firebase app.
//
// The symptom is worth more than the fix: `client` went 143 tests to **126**.
// Seventeen tests did not fail, they VANISHED — a whole suite stopped loading,
// and a suite that does not load reports nothing at all. Had the count been
// drifting upward from new work at the same time, it would have looked like
// progress.
//
// This is feature 017's finding verbatim: `MoodTileGrid` imported the taxonomy
// hook, which imported `core/firebase`, which initialised a real app at import
// time — and the fix there was the same one, moving the thing into a module
// with nothing else in its graph.
//
// So this file imports the READ repo and nothing that writes. Keep it that way.
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { reservationLabelKey } from '@svtrip/shared';
import type { ReservationState } from '@svtrip/shared';
import { Card } from '../components/ui';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useMyReservations } from '@svtrip/core/repos/reservationsRepo';

/** The state in the traveler's own vocabulary (FR-029). */
function StateLabel({ state }: { state: ReservationState }) {
  const { t } = useTranslation();
  return <span className="text-xs text-muted">{t(reservationLabelKey(state, 'traveler'))}</span>;
}

export function NextReservationCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { upcoming } = useMyReservations(user?.uid);
  const next = upcoming[0];

  // No card at all when there is nothing upcoming — not an empty card, not a
  // placeholder. Explorar belongs to discovery, and a traveler with no
  // reservation should see no trace of the feature here.
  if (!next) return null;

  const [date, time] = next.at.split('T');
  // A real <button>, not a Card with an onClick. 016's rule: a control only a
  // pointer can reach is, for some travelers, no control at all — and `Card` is
  // a plain div, so giving it a click handler would make this unreachable by
  // keyboard and silent to a screen reader.
  return (
    <button
      type="button"
      className="mt-8 w-full text-left"
      onClick={() => navigate('/reservations')}
      aria-label={t('reservations.upcomingCard')}
    >
      <Card className="space-y-1 p-4">
        <p className="eyebrow text-primary">{t('reservations.upcomingCard')}</p>
        <p className="font-bold">
          {date} · {time}
        </p>
        <StateLabel state={next.state} />
      </Card>
    </button>
  );
}
