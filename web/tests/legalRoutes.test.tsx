// T030 (feature 022): the public addresses for the legal documents — FR-013, FR-014, FR-015.
//
// `/privacidad` is the URL that gets submitted to Google Play's Data Safety form (feature 014's
// T096, open since that feature) and read by a store reviewer with no account. Everything in this
// file is about one failure: **that URL redirecting to a login screen.** `Router.tsx` ends its
// signed-out tree with `<Route path="*" element={<Navigate to="/sign-in?next=…" />}>`, so a route
// added BELOW that catch-all redirects — and a privacy policy that sends a reviewer to sign-in looks
// like the document is behind an account, which is the one thing the URL exists to disprove. That is
// worse than a 404.
//
// THE LegalScreen HERE IS THE REAL ONE, not a stub. A stubbed screen would prove a route matched; it
// would not prove a real document renders at that address.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { UserProfile } from '@svtrip/shared';
import { getLegalDocument } from '@svtrip/shared';

// Everything ELSE is stubbed — this suite is about routing the legal documents.
const stub = (label: string) => () => <div>{label}</div>;

vi.mock('../src/account/CompleteProfileScreen', () => ({ CompleteProfileScreen: stub('COMPLETE_PROFILE') }));
vi.mock('../src/account/ChooseMoodsScreen', () => ({ ChooseMoodsScreen: stub('CHOOSE_MOODS') }));
vi.mock('../src/traveler/DiscoverScreen', () => ({ DiscoverScreen: stub('DISCOVER') }));
vi.mock('../src/traveler/AIGuideScreen', () => ({ AIGuideScreen: stub('GUIDE') }));
vi.mock('../src/traveler/ProfileScreen', () => ({ ProfileScreen: stub('PROFILE') }));
vi.mock('../src/traveler/PlaceProfileScreen', () => ({ PlaceProfileScreen: stub('PLACE') }));
vi.mock('../src/traveler/DealsScreen', () => ({ DealsScreen: stub('DEALS') }));
vi.mock('../src/traveler/FavoritesScreen', () => ({ FavoritesScreen: stub('FAVORITES') }));
vi.mock('../src/public/PreviewScreen', () => ({ PreviewScreen: stub('PREVIEW') }));
vi.mock('../src/auth/SignInScreen', () => ({ SignInScreen: stub('SIGN_IN') }));
vi.mock('../src/auth/RegisterScreen', () => ({ RegisterScreen: stub('REGISTER') }));
vi.mock('../src/auth/ForgotPasswordScreen', () => ({ ForgotPasswordScreen: stub('FORGOT') }));
vi.mock('../src/auth/ResetPasswordScreen', () => ({ ResetPasswordScreen: stub('RESET') }));
vi.mock('../src/shell/DesktopLayout', () => ({
  DesktopLayout: () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Outlet } = require('react-router-dom');
    return (
      <div>
        SHELL
        <Outlet />
      </div>
    );
  },
}));

const authState = {
  user: null as { uid: string } | null,
  profile: null as UserProfile | null,
  loading: false,
};
vi.mock('@svtrip/core/auth/AuthProvider', () => ({ useAuth: () => authState }));
vi.mock('@svtrip/core/uiStore', () => ({
  useUiStore: (selector: (s: { persona: string }) => unknown) => selector({ persona: 'traveler' }),
}));

const { Router } = await import('../src/app/Router');

const settled = {
  onboardingComplete: true,
  profileVersion: 11,
  firstName: 'Neto',
  lastName: 'Mena',
  gender: 'masculine',
  age: 34,
  countryCode: 'SV',
} as unknown as UserProfile;

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<Router />);
}

afterEach(cleanup);
beforeEach(() => {
  authState.user = null;
  authState.profile = null;
  authState.loading = false;
});

describe('signed OUT — the app-store case', () => {
  it('serves /privacidad with no account, rather than redirecting to sign-in', async () => {
    renderAt('/privacidad');
    expect(await screen.findByText('Política de privacidad')).toBeTruthy();
    expect(screen.queryByText('SIGN_IN')).toBeNull();
    // And the URL did not change: a redirect would have rewritten it to /sign-in?next=…
    expect(window.location.pathname).toBe('/privacidad');
  });

  it('serves /terminos with no account', async () => {
    renderAt('/terminos');
    expect(await screen.findByText('Términos de servicio')).toBeTruthy();
    expect(screen.queryByText('SIGN_IN')).toBeNull();
    expect(window.location.pathname).toBe('/terminos');
  });
});

describe('signed IN — the in-app case, which `/speckit-analyze` caught', () => {
  beforeEach(() => {
    authState.user = { uid: 'u1' };
    authState.profile = settled;
  });

  it('serves both, rather than falling through to the signed-in catch-all', async () => {
    // This tree has its OWN catch-all, which sends an unknown path to the index. Adding the routes
    // only to the signed-out tree would fix the store case and break this one: a traveler tapping
    // the profile link would land on the home screen.
    renderAt('/privacidad');
    expect(await screen.findByText('Política de privacidad')).toBeTruthy();
    expect(screen.queryByText('DISCOVER')).toBeNull();
    cleanup();
    renderAt('/terminos');
    expect(await screen.findByText('Términos de servicio')).toBeTruthy();
  });
});

describe('the guard still holds — the allow beside the denies', () => {
  it('STILL redirects an unknown path to sign-in when signed out', async () => {
    // A change that made EVERYTHING public would pass every case above. This fails if the catch-all
    // was removed instead of the two routes being added above it.
    renderAt('/ruta-que-no-existe');
    expect(await screen.findByText('SIGN_IN')).toBeTruthy();
  });

  it('does not make an authenticated screen reachable without a session', async () => {
    renderAt('/profile');
    expect(await screen.findByText('SIGN_IN')).toBeTruthy();
    expect(screen.queryByText('PROFILE')).toBeNull();
  });
});

describe('the content is the REAL document', () => {
  it('renders the reservations section — the one a reader could not infer', async () => {
    renderAt('/privacidad');
    expect(await screen.findByText(/ve tu nombre, tu correo/)).toBeTruthy();
  });

  it('carries the last-updated date (FR-016)', async () => {
    renderAt('/privacidad');
    // CHANGED 2026-10-23: this asserted the literal /2026-10-19/, so every honest policy update
    // (push, feature 020 US4, moved the date) failed it while the page was correct. It now asserts
    // what FR-016 asks — that the page shows the DOCUMENT's own date — read from the document.
    const { updatedAt } = getLegalDocument('privacy', 'es')!;
    expect(await screen.findByText(new RegExp(updatedAt))).toBeTruthy();
  });
});
