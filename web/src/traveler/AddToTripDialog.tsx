// Put a place into a Trip, desktop (US1, T030 — FR-012, FR-013).
//
// Same rule as the mobile sheet and for the same reason: creating a Trip
// happens INSIDE this dialog, over the same mounted component, so the place
// being added is never lost. `catalogId` stays in props throughout; there is no
// navigation for it to survive.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Trip, TripStop } from '@svtrip/shared';
import { canSetTime, isBeforeTripStart, timeFor } from '@svtrip/shared';
import { Button, Card, Field, Spinner, TextInput } from '../components/ui';
import { Icon } from '@svtrip/core/Icon';
import { addStop, tripHasPlace, useTrips } from '@svtrip/core/repos/tripsRepo';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { TripForm } from './TripForm';

interface Props {
  catalogId: string;
  kind: TripStop['kind'];
  onClose: () => void;
}

export function AddToTripDialog({ catalogId, kind, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { trips, loading } = useTrips();
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  // Optional and collapsed, exactly as on mobile (FR-018, FR-019). The RULE is
  // imported from `shared/`; only the rendering differs between surfaces.
  const [showSchedule, setShowSchedule] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [floorError, setFloorError] = useState<string | null>(null);

  async function add(trip: Trip) {
    if (!user) return;
    // FR-020, checked here and nowhere else — the rules file deliberately does
    // not enforce it. The message names the start date.
    if (isBeforeTripStart(date, trip.startDate)) {
      setFloorError(t('trips.dateFloor', { date: trip.startDate }));
      return;
    }
    setFloorError(null);
    setBusy(true);
    try {
      // The same place cannot go into the same Trip twice. This REVERSES
      // FR-014, at the product owner's request after using it: a place filed
      // twice reads as a mistake rather than as two visits.
      //
      // Checked here rather than by keying the stop on `catalogId`, which would
      // make duplicates structurally impossible and could not be undone.
      if (await tripHasPlace(user.uid, trip.tripId, catalogId)) {
        setFloorError(t('trips.alreadyInTrip', { name: trip.name }));
        return;
      }
      await addStop(user.uid, trip.tripId, {
        catalogId,
        kind,
        date: date || undefined,
        time: timeFor(date || undefined, time || undefined),
      });
      setAdded(trip.name);
    } finally {
      setBusy(false);
    }
  }

  if (creating) {
    return (
      <TripForm
        onClose={() => setCreating(false)}
        onSaved={async (tripId) => {
          setCreating(false);
          if (!user) return;
          await addStop(user.uid, tripId, {
            catalogId,
            kind,
            date: date || undefined,
            time: timeFor(date || undefined, time || undefined),
          });
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold text-text">{t('trips.addTo')}</h2>
          <button type="button" aria-label={t('trips.cancel')} onClick={onClose} className="p-1">
            <Icon name="x" size={20} />
          </button>
        </div>

        {/* Names the Trip, never a bare "Added" (FR-013): with three Trips open,
            "Added" leaves the traveler unsure which one just changed. */}
        {added && (
          <p className="rounded-md bg-bg p-3 text-sm font-bold text-text">
            {t('trips.added', { name: added })}
          </p>
        )}

        {!showSchedule ? (
          <button
            type="button"
            className="text-sm font-bold text-primary"
            onClick={() => setShowSchedule(true)}
          >
            + {t('trips.date')}
          </button>
        ) : (
          <div className="space-y-3">
            <Field label={t('trips.date')}>
              <TextInput
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setFloorError(null);
                  if (!e.target.value) setTime('');
                }}
              />
            </Field>
            {/* FR-021: the control does not exist until a date is set. */}
            {canSetTime(date) && (
              <Field label={t('trips.time')}>
                <TextInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </Field>
            )}
          </div>
        )}

        {floorError && <p className="text-sm font-bold text-red">{floorError}</p>}

        {loading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {!loading && trips.length > 0 && (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {trips.map((trip) => (
              <li key={trip.tripId}>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-3 rounded-md p-3 text-left hover:bg-bg"
                  onClick={() => add(trip)}
                >
                  <Icon name="map" size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-text">{trip.name}</span>
                    <span className="block text-xs text-muted">{trip.startDate}</span>
                  </span>
                  <Icon name="plus" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button variant="secondary" fullWidth iconLeft="plus" onClick={() => setCreating(true)}>
          {t('trips.addToNew')}
        </Button>

        {added && (
          <Button fullWidth onClick={onClose}>
            {t('trips.save')}
          </Button>
        )}
      </Card>
    </div>
  );
}
