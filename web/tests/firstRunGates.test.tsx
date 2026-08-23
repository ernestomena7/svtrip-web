// The two first-run gates on the desktop web app, and their order.
//
// This surface shipped with NEITHER. Feature 011 added the profile step; the
// mood step was still missing, so a web-only account reached Discover with
// `preferences.vibes` empty — and "Para vos", on this same surface, silently
// read a preference nobody had ever been offered the chance to set.
//
// `client/src/app/App.test.tsx` pins the identical order on mobile. Both suites
// exist because the two surfaces route independently: the mobile one passing
// says nothing about this one, which is exactly how the gap survived.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { UserProfile } from '@svtrip/shared';

// Screens are stubbed: this suite is about ROUTING, not their contents.
const stub = (label: string) => () => <div>{label}</div>;

vi.mock('../src/account/CompleteProfileScreen', () => ({
  CompleteProfileScreen: stub('COMPLETE_PROFILE'),
}));
vi.mock('../src/account/ChooseMoodsScreen', () => ({
  ChooseMoodsScreen: stub('CHOOSE_MOODS'),
}));
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
vi.mock('../src/shell/DesktopLayout', () => {
  return {
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
  };
});

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

/** Everything a traveler needs to reach the app: stamped, filled in, chosen. */
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
  authState.user = { uid: 'u1' };
  authState.profile = settled;
  authState.loading = false;
});

describe('the mood gate (the one this surface never had)', () => {
  it('asks a new account for its moods before letting it reach the app', async () => {
    authState.profile = { ...settled, onboardingComplete: false } as UserProfile;
    renderAt('/discover');
    expect(await screen.findByText('CHOOSE_MOODS')).toBeTruthy();
    expect(screen.queryByText('DISCOVER')).toBeNull();
  });

  it('intercepts whatever the path is — it is a checkpoint, not a route', async () => {
    // No URL of its own on purpose: a bookmarkable one would let a traveler
    // navigate straight past the thing it gates.
    authState.profile = { ...settled, onboardingComplete: false } as UserProfile;
    renderAt('/profile');
    expect(await screen.findByText('CHOOSE_MOODS')).toBeTruthy();
  });

  it('lets a traveler who has already chosen straight through', async () => {
    renderAt('/discover');
    expect(await screen.findByText('DISCOVER')).toBeTruthy();
    expect(screen.queryByText('CHOOSE_MOODS')).toBeNull();
  });

  it('does not stop a signed-out visitor', async () => {
    // `/discover` signed out is the PUBLIC preview (feature 007, FR-018), not
    // sign-in. Neither gate may reach in front of it: they belong to accounts.
    authState.user = null;
    authState.profile = null;
    renderAt('/discover');
    expect(await screen.findByText('PREVIEW')).toBeTruthy();
    expect(screen.queryByText('CHOOSE_MOODS')).toBeNull();
  });
});

describe('the order of the two gates', () => {
  it('asks who you are before what you like', async () => {
    // Both are pending; only one can win, and the order is deliberate — it
    // matches the mobile app exactly, so the same account signing up on either
    // surface is asked the same questions in the same sequence.
    authState.profile = {
      onboardingComplete: false,
      profileVersion: 11,
    } as UserProfile;
    renderAt('/discover');
    expect(await screen.findByText('COMPLETE_PROFILE')).toBeTruthy();
    expect(screen.queryByText('CHOOSE_MOODS')).toBeNull();
  });

  it('moves on to the moods once the profile is filled in', async () => {
    authState.profile = { ...settled, onboardingComplete: false } as UserProfile;
    renderAt('/discover');
    expect(await screen.findByText('CHOOSE_MOODS')).toBeTruthy();
    expect(screen.queryByText('COMPLETE_PROFILE')).toBeNull();
  });
});

describe('what the mood gate must NOT do', () => {
  it('stops an account that predates feature 011 but has already chosen moods', async () => {
    // Deliberately NOT grandfathered by `profileVersion`, unlike the profile
    // step above it. `onboardingComplete` has existed since feature 001, so an
    // older account already answered this question and is already `true` —
    // measured against the live project: of 32 real accounts, exactly one was
    // not. A profileVersion condition here would permanently exempt the only
    // accounts that genuinely never chose.
    authState.profile = { onboardingComplete: true } as UserProfile;
    renderAt('/discover');
    expect(await screen.findByText('DISCOVER')).toBeTruthy();
    expect(screen.queryByText('CHOOSE_MOODS')).toBeNull();
  });
});
