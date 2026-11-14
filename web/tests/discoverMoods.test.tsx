// Desktop Discover reads the LIVE mood vocabulary (the defect feature 014 predicted and 019 re-found).
//
// `DiscoverScreen` used to iterate the static `MOODS` constant while the phone used
// `useMergedTaxonomy`, so a mood a super admin created — or renamed — appeared on mobile and was
// SILENTLY absent on desktop. The hook is mocked to return one built-in and one admin-created mood;
// what is under test is that the screen renders whatever the hook returns, not where it comes from.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@svtrip/core/i18n';

vi.mock('@svtrip/core/repos/discoverRepo', () => ({
  fetchPlaces: () => Promise.resolve([]),
  forYou: (p: unknown[]) => p,
  byMood: (p: unknown[]) => p,
}));
vi.mock('@svtrip/core/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, profile: { preferences: { vibes: [] } }, loading: false }),
}));
vi.mock('@svtrip/core/repos/useFavorites', () => ({
  useFavorites: () => ({ favorites: [], isFavorite: () => false, toggle: () => undefined }),
}));
vi.mock('@svtrip/core/taxonomy/useTaxonomy', () => ({
  useMergedTaxonomy: () => ({
    keys: ['beach', 'admin-made-mood'],
    label: (k: string) => (k === 'admin-made-mood' ? 'Mood del admin' : 'Playa'),
    icon: () => ({ kind: 'builtIn' as const, name: 'star' as const }),
  }),
}));
vi.mock('../src/traveler/NextReservationCard', () => ({ NextReservationCard: () => null }));
vi.mock('../src/traveler/AddToTripDialog', () => ({ AddToTripDialog: () => null }));
vi.mock('../src/shell/DesktopLayout', () => ({
  DesktopLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { DiscoverScreen } = await import('../src/traveler/DiscoverScreen');

afterEach(cleanup);

describe('desktop Discover mood chips', () => {
  it('shows a mood an admin created, which the static list never contained', () => {
    render(
      <MemoryRouter>
        <DiscoverScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Mood del admin' })).toBeTruthy();
  });

  it('still shows the built-in moods the hook returns', () => {
    render(
      <MemoryRouter>
        <DiscoverScreen />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Playa' })).toBeTruthy();
  });
});
