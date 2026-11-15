// Feature 024 (T023, FR-009): the public place profile — where an AI assistant's link lands. NEW FILE.
//
// The failure this file exists for: a link from an assistant bouncing a signed-out visitor to the
// sign-in screen, which turns every suggestion into a dead end. The router and the screen are REAL;
// only the network, the map and the gallery viewer are stubbed.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@svtrip/core/i18n';

const stub = (label: string) => () => <div>{label}</div>;
vi.mock('../src/traveler/LocationPreviewMap', () => ({ LocationPreviewMap: stub('MAP') }));
vi.mock('../src/traveler/GalleryViewer', () => ({ GalleryViewer: () => null }));
vi.mock('../src/traveler/PlaceProfileScreen', () => ({ PlaceProfileScreen: stub('SIGNED_IN_PROFILE') }));
vi.mock('../src/traveler/DiscoverScreen', () => ({ DiscoverScreen: stub('DISCOVER') }));
vi.mock('../src/public/PreviewScreen', () => ({ PreviewScreen: stub('PREVIEW') }));
vi.mock('../src/auth/SignInScreen', () => ({ SignInScreen: stub('SIGN_IN') }));
vi.mock('../src/auth/RegisterScreen', () => ({ RegisterScreen: stub('REGISTER') }));
vi.mock('@svtrip/core/apiClient', () => ({ postJson: vi.fn(async () => ({ ok: true })) }));

const authState = { user: null as { uid: string } | null, profile: null, loading: false };
vi.mock('@svtrip/core/auth/AuthProvider', () => ({ useAuth: () => authState }));

const { Router } = await import('../src/app/Router');

const PLACE = {
  place: {
    id: 'cafe-a', name: 'Café A', nameI18n: null, description: 'Pupusas de queso', descriptionI18n: null,
    businessType: 'restaurant-cafe', bannerURL: null, gallery: [], lat: 13.49, lng: -89.38, openingHours: [],
    phone: null, whatsapp: null, score: { kind: 'average', value: 4.5, count: 2 }, reservable: true,
  },
  promotions: [],
  reviews: [{ id: 'r1', authorName: 'Ana', rating: 5, comment: 'Muy rico', reply: null }],
};

function respond(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, json: async () => body })));
}

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<Router />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  authState.user = null;
});

describe('signed out — an assistant link opens the place, not the sign-in screen', () => {
  it('renders the public profile at /place/:id and keeps the URL', async () => {
    respond(200, PLACE);
    renderAt('/place/cafe-a');
    expect(await screen.findByRole('heading', { name: 'Café A' })).toBeTruthy();
    expect(screen.getByText('Muy rico')).toBeTruthy();
    expect(screen.queryByText('SIGN_IN')).toBeNull();
    expect(window.location.pathname).toBe('/place/cafe-a');
  });

  it('offers ONE way in for the account actions, returning to this place', async () => {
    respond(200, PLACE);
    renderAt('/place/cafe-a');
    await screen.findByRole('heading', { name: 'Café A' });
    const box = screen.getByTestId('public-sign-in');
    expect(box.textContent).toMatch(/reservar/i);
    const link = box.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/sign-in?next=%2Fplace%2Fcafe-a');
  });

  it('a place that is not available shows the empty state with a way to explore — never a blank page', async () => {
    respond(404, { code: 'not_available' });
    renderAt('/place/hidden-h');
    expect(await screen.findByText('Este lugar no está disponible por ahora')).toBeTruthy();
    expect(screen.getByText('Explorar SVTrip')).toBeTruthy();
  });

  it('a server error shows the error state, not the empty state', async () => {
    respond(500, {});
    renderAt('/place/cafe-a');
    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});

describe('the allow beside the deny', () => {
  it('signed in, /place/:id is still the FULL profile', async () => {
    authState.user = { uid: 'u1' };
    (authState as { profile: unknown }).profile = { onboardingComplete: true };
    renderAt('/place/cafe-a');
    expect(await screen.findByText('SIGNED_IN_PROFILE')).toBeTruthy();
  });

  it('signed out, an unrelated private path still goes to sign-in', async () => {
    renderAt('/trips');
    expect(await screen.findByText('SIGN_IN')).toBeTruthy();
  });
});
