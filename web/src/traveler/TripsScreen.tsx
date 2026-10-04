// The traveler's Trips, desktop (US1, T028).
//
// Same data, same order, same empty-state obligation as mobile (FR-008). What
// differs is only the layout: a grid with room rather than a stacked list.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Trip } from '@svtrip/shared';
import { Button, Card, EmptyState, Spinner } from '../components/ui';
import { Icon } from '@svtrip/core/Icon';
import { useTrips, deleteTrip } from '@svtrip/core/repos/tripsRepo';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { TripForm } from './TripForm';

export function TripsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trips, loading } = useTrips();
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<Trip | null>(null);

  async function confirmDelete() {
    if (!user || !confirming) return;
    const trip = confirming;
    setConfirming(null);
    await deleteTrip(user.uid, trip.tripId);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-text">{t('trips.title')}</h1>
        {trips.length > 0 && (
          <Button iconLeft="plus" onClick={() => setCreating(true)}>
            {t('trips.create')}
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {!loading && trips.length === 0 && (
        <EmptyState
          icon="map"
          title={t('trips.empty.title')}
          body={t('trips.empty.body')}
          action={
            <Button iconLeft="plus" onClick={() => setCreating(true)}>
              {t('trips.empty.cta')}
            </Button>
          }
        />
      )}

      {!loading && trips.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <li key={trip.tripId}>
              <Card className="flex items-center gap-3 p-4">
                <button
                  type="button"
                  className="flex flex-1 items-center gap-3 text-left"
                  onClick={() => navigate(`/trips/${trip.tripId}`)}
                >
                  <Icon name="map" size={22} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-text">{trip.name}</span>
                    <span className="block text-sm text-muted">{trip.startDate}</span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={t('trips.delete')}
                  className="rounded-md p-2 text-muted hover:bg-bg"
                  onClick={() => setConfirming(trip)}
                >
                  <Icon name="trash" size={18} />
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <TripForm
          onClose={() => setCreating(false)}
          onSaved={(tripId) => {
            setCreating(false);
            navigate(`/trips/${tripId}`);
          }}
        />
      )}

      {/* Confirmed, never instant (FR-005): a Trip holds work assembled by hand. */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm space-y-4 p-6">
            <p className="font-bold text-text">{confirming.name}</p>
            <p className="text-sm text-muted">{t('trips.deleteConfirm')}</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirming(null)}>
                {t('trips.cancel')}
              </Button>
              <Button onClick={confirmDelete}>{t('trips.delete')}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
