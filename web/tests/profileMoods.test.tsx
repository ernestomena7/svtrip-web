// The moods-of-interest editor on the desktop profile screen (feature 009, US2).
//
// Three things are worth pinning here, and they are the three that would be
// *wrong* rather than merely ugly if they regressed:
//
//   1. The pills reflect what is actually stored, not a local guess.
//   2. A toggle persists through `updatePreferences` and NOT `completeOnboarding`
//      — the latter also flips `onboardingComplete`, which this edit path has no
//      business touching (FR-007).
//   3. The last remaining mood cannot be deselected (FR-004). An empty selection
//      is not a deliberate choice, it is the absence of a personalization signal,
//      and Discover's "Para vos" and the AI Guide both read it.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@svtrip/core/i18n';

// The screen gained a router dependency in feature 010 (the super-admin link
// navigates to /admin/taxonomy), so it can no longer be rendered bare.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const updatePreferences = vi.fn((_uid: string, _prefs: { vibes?: string[] }) => Promise.resolve());
let mockVibes: string[] = [];

vi.mock('@svtrip/core/auth/userProfile', () => ({
  updatePreferences: (uid: string, prefs: { vibes?: string[] }) => updatePreferences(uid, prefs),
  // Feature 011 added a second writer to this module; the screen imports both.
  saveProfileFields: vi.fn(() => Promise.resolve()),
}));

vi.mock('@svtrip/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: {
      uid: 'traveler-1',
      // Feature 010's `useSuperAdmin` reads the claim off the ID token. An
      // ordinary traveler carries none, which is the state these tests are
      // about — the admin link must not appear for them.
      getIdTokenResult: () => Promise.resolve({ claims: {} }),
    },
    profile: { displayName: 'Neto', email: 'n@example.com', preferences: { vibes: mockVibes } },
    loading: false,
  }),
}));

vi.mock('@svtrip/core/auth/authService', () => ({
  signOutUser: vi.fn(() => Promise.resolve()),
  // Feature 011: the screen asks whether the account has a password of the
  // product's own, to decide whether to offer a password change at all. `false`
  // here keeps these tests about the moods editor — a Google-style account.
  hasPasswordProvider: () => false,
  changePassword: vi.fn(() => Promise.resolve()),
}));

// Feature 010 made the mood list admin-managed, so this screen now reads it from
// Firestore. Stubbed to the built-in vocabulary: what is under test here is the
// EDITOR's behaviour (persist, floor, first-ever selection), not where the list
// of moods comes from — and the real hook pulls in the Firebase SDK, which has
// no credentials in a unit test.
vi.mock('@svtrip/core/taxonomy/useTaxonomy', async () => {
  const { MOODS } = await import('@svtrip/shared');
  return {
    useMergedTaxonomy: () => ({ keys: [...MOODS], label: (k: string) => LABELS[k] ?? k }),
    useTaxonomy: () => ({ entries: [], loading: false, reload: () => {} }),
    useScopedServices: () => ({ keys: [], label: (k: string) => k }),
  };
});

/** The Spanish labels the real i18n bundle would resolve for the built-ins. */
const LABELS: Record<string, string> = {
  'romantic-date': 'Cita romántica',
  'extreme-adventure': 'Aventura extrema',
  'local-food': 'Comida local',
  nightlife: 'Vida nocturna',
  beach: 'Playa',
  'colonial-town': 'Pueblos coloniales',
  hiking: 'Senderismo',
  culture: 'Cultura',
};

// The shell pulls in routing and nav that this test has no opinion about; the
// editor under test renders inside it either way.
vi.mock('../src/shell/DesktopLayout', () => ({
  DesktopLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { ProfileScreen } = await import('../src/traveler/ProfileScreen');

afterEach(cleanup);
beforeEach(() => updatePreferences.mockClear());

/** The pill for one mood, found by its visible (translated) label. */
function pill(label: string): HTMLButtonElement {
  return screen.getByRole('button', { name: new RegExp(label, 'i') }) as HTMLButtonElement;
}

describe('moods editor — desktop profile (feature 009, US2)', () => {
  it('reflects the stored selection rather than a local default', () => {
    mockVibes = ['beach', 'culture'];
    render(<ProfileScreen />);

    expect(pill('Playa').getAttribute('aria-pressed')).toBe('true');
    expect(pill('Cultura').getAttribute('aria-pressed')).toBe('true');
    // Untouched moods stay off — the editor shows what is saved, not everything.
    expect(pill('Vida nocturna').getAttribute('aria-pressed')).toBe('false');
  });

  it('adds a mood by persisting the widened selection immediately', () => {
    mockVibes = ['beach'];
    render(<ProfileScreen />);

    pill('Cultura').click();

    // Instant persist: no save button, no confirmation step (FR-005).
    expect(updatePreferences).toHaveBeenCalledWith('traveler-1', {
      vibes: ['beach', 'culture'],
    });
  });

  it('removes a mood when more than one is selected', () => {
    mockVibes = ['beach', 'culture'];
    render(<ProfileScreen />);

    pill('Playa').click();

    expect(updatePreferences).toHaveBeenCalledWith('traveler-1', { vibes: ['culture'] });
  });

  it('refuses to deselect the last remaining mood (FR-004)', () => {
    mockVibes = ['beach'];
    render(<ProfileScreen />);

    const last = pill('Playa');
    // Disabled rather than silently ignoring the click, so the floor is visible
    // instead of reading as a dead control.
    expect(last.disabled).toBe(true);

    last.click();
    expect(updatePreferences).not.toHaveBeenCalled();
  });

  it('shows no taxonomy-manager link to an ordinary traveler (feature 010)', () => {
    // Absent, not disabled. A control that exists only to refuse you advertises
    // a screen this account has no business knowing about — and the link is
    // gated on the `svtripSuperAdmin` claim, which this mocked token lacks.
    mockVibes = ['beach'];
    render(<ProfileScreen />);
    expect(screen.queryByRole('button', { name: /taxonom/i })).toBeNull();
  });

  it('lets an account that has never chosen a mood pick its first one', () => {
    // The case this story exists for: the desktop app has no onboarding flow, so
    // an account created here starts with an empty selection and, before this
    // feature, had no screen anywhere on this surface to ever set one.
    mockVibes = [];
    render(<ProfileScreen />);

    pill('Playa').click();

    expect(updatePreferences).toHaveBeenCalledWith('traveler-1', { vibes: ['beach'] });
  });
});
