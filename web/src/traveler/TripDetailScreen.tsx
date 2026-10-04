// One Trip and its stops, desktop (US1 T029/T027, US2 T044/T047/T048, US4 T065–T068).
//
// The order comes from `tripOrder()` in `shared/`, exactly as the mobile screen
// does, and is NOT re-derived here — FR-044 puts the same Trip on both surfaces
// and two implementations of "chronological first" do not stay identical.
//
// Two states are DERIVED at render and never stored:
//   - unavailable: the catalog entry no longer resolves (FR-033). The stop
//     stays visible; hiding it reads as data loss in something built by hand.
//   - conflicting: the stop's date precedes the Trip's start (FR-034). Marked,
//     never silently corrected.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Reorder } from 'framer-motion';
import type { Place, Trip, TripStop } from '@svtrip/shared';
import { canSetTime, coverImage, isBeforeTripStart, isScheduled, timeFor } from '@svtrip/shared';
import { Button, Card, EmptyState, Field, Spinner, TextInput } from '../components/ui';
import { Icon } from '@svtrip/core/Icon';
import { fetchPlaces } from '@svtrip/core/repos/discoverRepo';
import {
  useTripStops,
  useTrips,
  removeStop,
  scheduleStop,
  repositionStop,
} from '@svtrip/core/repos/tripsRepo';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { TripForm } from './TripForm';

export function TripDetailScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { trips, loading: tripsLoading } = useTrips();
  const { stops, loading: stopsLoading } = useTripStops(id);
  const [catalog, setCatalog] = useState<Map<string, Place>>(new Map());
  const [editing, setEditing] = useState(false);

  /** The stop whose date and time are being edited (FR-022). */
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [floorError, setFloorError] = useState<string | null>(null);
  /** The stop whose removal is being confirmed. */
  const [removing, setRemoving] = useState<TripStop | null>(null);

  const trip: Trip | undefined = useMemo(() => trips.find((x) => x.tripId === id), [trips, id]);

  // GROUP MEMBERSHIP IS DECIDED BY WHETHER THE STOP HAS A DATE, and by nothing
  // else (FR-031). Both groups come out of the already-ordered list, so the
  // ordering rule is applied once and split, never re-derived.
  const scheduled = useMemo(() => stops.filter(isScheduled), [stops]);
  const unscheduled = useMemo(() => stops.filter((x) => !isScheduled(x)), [stops]);

  /**
   * The unscheduled group as the traveler is currently dragging it.
   *
   * Local because a drag moves things dozens of times per second and the
   * subscription is not going to keep up; re-seeded whenever the persisted
   * group changes, so a write from the other surface still lands.
   */
  const [order, setOrder] = useState<TripStop[]>([]);
  // Keyed on the IDS, not on the array's identity.
  //
  // `unscheduled` is derived, so it is a new array on any render that produces
  // a new `stops` — and re-seeding on identity turns that into setState inside
  // an effect that depends on its own output. Found by a component test, which
  // exhausted the heap rather than failing an assertion; the real subscription
  // memoizes and hid it.
  const orderKey = unscheduled.map((x) => x.stopId).join(',');
  useEffect(() => setOrder(unscheduled), [orderKey]);

  useEffect(() => {
    let cancelled = false;
    fetchPlaces()
      .then((places) => {
        if (!cancelled) setCatalog(new Map(places.map((p) => [p.placeId, p])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function startEditing(stop: TripStop) {
    setScheduling(stop.stopId);
    setDraftDate(stop.date ?? '');
    setDraftTime(stop.time ?? '');
    setFloorError(null);
  }

  async function saveSchedule(stopId: string) {
    if (!user || !id || !trip) return;
    // The same floor as the add dialog, from the same function in `shared/`
    // (FR-020) — the rules file enforces it in neither.
    if (isBeforeTripStart(draftDate, trip.startDate)) {
      setFloorError(t('trips.dateFloor', { date: trip.startDate }));
      return;
    }
    await scheduleStop(user.uid, id, stopId, {
      date: draftDate || undefined,
      time: timeFor(draftDate || undefined, draftTime || undefined),
    });
    setScheduling(null);
  }

  /** Write the arrangement the traveler just made (FR-030). */
  async function persistOrder(stopId: string, next: TripStop[] = order) {
    if (!user || !id) return;
    const toIndex = next.findIndex((x) => x.stopId === stopId);
    if (toIndex < 0) return;
    await repositionStop(user.uid, id, stopId, next, toIndex);
  }

  /**
   * The non-drag path (T066). A drag gesture is unreachable by keyboard and by
   * screen reader, and Principle V binds — an obligation the plan adds, not one
   * the spec states.
   */
  async function move(stopId: string, delta: number) {
    const from = order.findIndex((x) => x.stopId === stopId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    await persistOrder(stopId, next);
  }


  async function confirmRemove() {
    if (!user || !id || !removing) return;
    const stopId = removing.stopId;
    setRemoving(null);
    await removeStop(user.uid, id, stopId);
  }

  const loading = tripsLoading || stopsLoading;

  /** One stop's card. Shared by both groups so splitting them changed no pixels. */
  function renderStop(stop: TripStop, draggable = false) {
    const place = catalog.get(stop.catalogId);
    const photo = place ? coverImage(place) : undefined;
    const conflicting = trip ? isBeforeTripStart(stop.date, trip.startDate) : false;
    const index = order.findIndex((x) => x.stopId === stop.stopId);

    return (
      <>
        <Card className="flex items-center gap-4 p-3">
          <div
            className="h-16 w-16 shrink-0 rounded-md bg-bg"
            style={photo ? { background: `url(${photo}) center/cover` } : undefined}
          />
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            disabled={!place}
            onClick={() => place && navigate(`/place/${place.placeId}`)}
          >
            <span className="block truncate font-bold text-text">
              {place?.name ?? stop.catalogId}
            </span>
            {!place && (
              <span className="block text-xs font-bold text-red">{t('trips.unavailable')}</span>
            )}
            {stop.date && (
              <span className="block text-xs text-muted">
                {stop.date}
                {stop.time ? ` · ${stop.time}` : ''}
              </span>
            )}
            {conflicting && (
              // Marked, NEVER silently corrected (FR-034).
              <span className="block text-xs font-bold text-red">{t('trips.conflicting')}</span>
            )}
            {stop.reason && (
              // The guide's words, rendered as the guide's (FR-040).
              <span className="block truncate text-xs italic text-muted">
                {t('trips.fromGuide')}: {stop.reason}
              </span>
            )}
          </button>

          {draggable && (
            <span className="flex flex-col">
              <button
                type="button"
                aria-label={t('trips.moveUp')}
                disabled={index <= 0}
                className="rounded-md px-2 text-muted hover:bg-bg disabled:opacity-30"
                onClick={() => move(stop.stopId, -1)}
              >
                <Icon name="chevron-down" size={16} className="rotate-180" />
              </button>
              <button
                type="button"
                aria-label={t('trips.moveDown')}
                disabled={index < 0 || index >= order.length - 1}
                className="rounded-md px-2 text-muted hover:bg-bg disabled:opacity-30"
                onClick={() => move(stop.stopId, 1)}
              >
                <Icon name="chevron-down" size={16} />
              </button>
            </span>
          )}

          <button
            type="button"
            aria-label={t('trips.date')}
            className="rounded-md p-2 text-muted hover:bg-bg"
            onClick={() => startEditing(stop)}
          >
            <Icon name="calendar" size={18} />
          </button>
          <button
            type="button"
            aria-label={t('trips.removeStop')}
            className="rounded-md p-2 text-muted hover:bg-bg"
            onClick={() => setRemoving(stop)}
          >
            <Icon name="trash" size={18} />
          </button>
        </Card>

        {scheduling === stop.stopId && (
          <Card className="mt-2 space-y-3 p-4">
            <Field label={t('trips.date')}>
              <TextInput
                type="date"
                value={draftDate}
                onChange={(e) => {
                  setDraftDate(e.target.value);
                  setFloorError(null);
                  // Clearing the date clears the time (FR-023).
                  if (!e.target.value) setDraftTime('');
                }}
              />
            </Field>
            {canSetTime(draftDate) && (
              <Field label={t('trips.time')}>
                <TextInput
                  type="time"
                  value={draftTime}
                  onChange={(e) => setDraftTime(e.target.value)}
                />
              </Field>
            )}
            {floorError && <p className="text-sm font-bold text-red">{floorError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setScheduling(null)}>
                {t('trips.cancel')}
              </Button>
              <Button onClick={() => saveSchedule(stop.stopId)}>{t('trips.save')}</Button>
            </div>
          </Card>
        )}
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          aria-label={t('common.back')}
          className="rounded-md p-1 text-muted hover:bg-bg"
          onClick={() => navigate('/trips')}
        >
          <Icon name="chevron-left" size={22} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-extrabold text-text">
            {trip?.name ?? t('trips.title')}
          </h1>
          {trip && <p className="text-sm text-muted">{trip.startDate}</p>}
        </div>
        {trip && (
          <button
            type="button"
            aria-label={t('trips.edit')}
            className="rounded-md p-2 text-muted hover:bg-bg"
            onClick={() => setEditing(true)}
          >
            <Icon name="settings" size={18} />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {!loading && stops.length === 0 && (
        <EmptyState icon="map" title={t('trips.empty.title')} body={t('trips.empty.body')} />
      )}

      {!loading && stops.length > 0 && (
        <div className="space-y-3">
          {/* SCHEDULED — deliberately not draggable (FR-031). These stops are
              ordered by the day and hour the traveler gave them; dragging one
              would mean either lying about its date or silently changing it. */}
          {scheduled.length > 0 && (
            <>
              <p className="eyebrow">{t('trips.scheduled')}</p>
              <ul className="space-y-3">
                {scheduled.map((stop) => (
                  <li key={stop.stopId}>{renderStop(stop)}</li>
                ))}
              </ul>
            </>
          )}

          {order.length > 0 && (
            <>
              <p className="eyebrow">{t('trips.unscheduled')}</p>
              <p className="text-xs text-muted">{t('trips.reorderHint')}</p>
              {/* The reorder primitives ship with the motion library already in
                  both surfaces — verified at runtime. Absent from `core/`,
                  which is why the drag UI stays per-surface. */}
              <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-3">
                {order.map((stop) => (
                  <Reorder.Item
                    key={stop.stopId}
                    value={stop}
                    // Persisted on drag END, not on every frame: a drag emits a
                    // reorder per pointer move.
                    onDragEnd={() => persistOrder(stop.stopId)}
                  >
                    {renderStop(stop, true)}
                  </Reorder.Item>
                ))}
              </Reorder.Group>
            </>
          )}
        </div>
      )}

      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-sm space-y-4 p-6">
            <p className="font-bold text-text">
              {catalog.get(removing.catalogId)?.name ?? removing.catalogId}
            </p>
            <p className="text-sm text-muted">{t('trips.removeStopConfirm')}</p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                {t('trips.cancel')}
              </Button>
              <Button onClick={confirmRemove}>{t('trips.removeStop')}</Button>
            </div>
          </Card>
        </div>
      )}
      {editing && trip && (
        <TripForm trip={trip} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      )}
    </div>
  );
}
