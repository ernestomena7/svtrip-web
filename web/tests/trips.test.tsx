// T039 (feature 016): the same behaviours on the desktop screens.
//
// Not a copy for its own sake. The two surfaces have diverged since feature
// 007 and each renders its own components, so "it works on mobile" says nothing
// about this one — while the parts that MUST agree (the ordering rule, the
// writes) live in `shared/` and `core/` and are tested once, there.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import type { Trip } from '@svtrip/shared';

let trips: Trip[] = [];
const addStop = vi.fn(async () => 'stop-new');
const tripHasPlace = vi.fn(async () => false);
const createTrip = vi.fn(async () => 'trip-new');
const deleteTrip = vi.fn(async () => undefined);

vi.mock('@svtrip/core/repos/tripsRepo', () => ({
  useTrips: () => ({ trips, loading: false }),
  useTripStops: () => ({ stops: [], loading: false }),
  addStop: (...a: unknown[]) => addStop(...(a as [])),
  tripHasPlace: (...a: unknown[]) => tripHasPlace(...(a as [])),
  createTrip: (...a: unknown[]) => createTrip(...(a as [])),
  updateTrip: vi.fn(),
  deleteTrip: (...a: unknown[]) => deleteTrip(...(a as [])),
  removeStop: vi.fn(),
}));
vi.mock('@svtrip/core/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'alice' } }),
}));
const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'name' in opts) return `${key}:${String(opts.name)}`;
      if (opts && 'date' in opts) return `${key}:${String(opts.date)}`;
      return key;
    },
    i18n: { language: 'es' },
  }),
}));

const { TripsScreen } = await import('../src/traveler/TripsScreen');
const { AddToTripDialog } = await import('../src/traveler/AddToTripDialog');

function trip(over: Partial<Trip> = {}): Trip {
  return {
    tripId: 't1',
    name: 'Costa',
    startDate: '2026-10-10',
    origin: 'manual',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

beforeEach(() => {
  // Explicit: this workspace does not auto-cleanup between tests, so a second
  // render finds the first one still mounted and every query goes ambiguous.
  cleanup();
  vi.clearAllMocks();
  trips = [];
});

describe('the desktop Trips list', () => {
  it('explains the empty state rather than showing an empty grid (FR-008)', () => {
    render(<TripsScreen />);
    expect(screen.getByText('trips.empty.title')).toBeDefined();
    expect(screen.getByText('trips.empty.body')).toBeDefined();
  });

  it('renders each Trip and opens it', () => {
    trips = [trip()];
    render(<TripsScreen />);
    expect(screen.getByText('Costa')).toBeDefined();
    fireEvent.click(screen.getByText('Costa'));
    expect(navigate).toHaveBeenCalledWith('/trips/t1');
  });

  it('confirms before deleting (FR-005)', async () => {
    trips = [trip()];
    render(<TripsScreen />);
    fireEvent.click(screen.getByLabelText('trips.delete'));
    expect(deleteTrip).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('trips.delete'));
    await waitFor(() => expect(deleteTrip).toHaveBeenCalledWith('alice', 't1'));
  });
});

describe('the desktop add-to-Trip dialog', () => {
  it('adds the place and names the Trip (FR-013)', async () => {
    trips = [trip()];
    render(<AddToTripDialog catalogId="el-tunco" kind="place" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Costa'));
    await waitFor(() =>
      expect(addStop).toHaveBeenCalledWith('alice', 't1', { catalogId: 'el-tunco', kind: 'place' }),
    );
    expect(await screen.findByText('trips.added:Costa')).toBeDefined();
  });

  it('creating one from inside the dialog keeps the place being added (FR-012)', async () => {
    render(<AddToTripDialog catalogId="el-tunco" kind="place" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('trips.addToNew'));
    fireEvent.change(screen.getByPlaceholderText('trips.namePlaceholder'), {
      target: { value: 'Nuevo' },
    });
    fireEvent.click(screen.getByText('trips.save'));
    await waitFor(() => expect(createTrip).toHaveBeenCalled());
    await waitFor(() =>
      expect(addStop).toHaveBeenCalledWith('alice', 'trip-new', {
        catalogId: 'el-tunco',
        kind: 'place',
      }),
    );
  });
});

describe('the desktop scheduling rules (US2)', () => {
  function openSchedule() {
    render(<AddToTripDialog catalogId="el-tunco" kind="place" onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('+ trips.date'));
  }

  it('keeps the date collapsed so a place is addable in one move (FR-019)', () => {
    trips = [trip()];
    render(<AddToTripDialog catalogId="el-tunco" kind="place" onClose={vi.fn()} />);
    expect(screen.queryByLabelText('trips.date')).toBeNull();
  });

  it('offers no time control until a date is set (FR-021)', () => {
    trips = [trip()];
    openSchedule();
    expect(screen.queryByLabelText('trips.time')).toBeNull();
    fireEvent.change(screen.getByLabelText('trips.date'), { target: { value: '2026-10-11' } });
    expect(screen.getByLabelText('trips.time')).toBeDefined();
  });

  it('refuses a date before the Trip starts and names the start date (FR-020)', async () => {
    trips = [trip()];
    openSchedule();
    fireEvent.change(screen.getByLabelText('trips.date'), { target: { value: '2026-10-09' } });
    fireEvent.click(screen.getByText('Costa'));
    expect(await screen.findByText('trips.dateFloor:2026-10-10')).toBeDefined();
    expect(addStop).not.toHaveBeenCalled();
  });
});
