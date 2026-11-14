// T024 + T028a (feature 022): the twin of `client/src/features/legal/legalEntryPoints.test.tsx`.
//
// The documents must be reachable from the bottom of the profile — BELOW sign-out (FR-011) — and
// from the registration screen, before an account exists (FR-015). The version must come from the
// build, not a literal (SC-008). Prominence is deliberately not asserted (T042 judges it).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@svtrip/core/i18n';

vi.mock('@svtrip/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'traveler-1', getIdTokenResult: () => Promise.resolve({ claims: {} }) },
    profile: { displayName: 'Neto', email: 'n@example.com', preferences: { vibes: ['beach'] } },
    loading: false,
  }),
}));
vi.mock('@svtrip/core/auth/userProfile', () => ({
  saveProfileFields: vi.fn(() => Promise.resolve()),
  updatePreferences: vi.fn(() => Promise.resolve()),
}));
vi.mock('@svtrip/core/auth/authService', () => ({
  signOutUser: vi.fn(() => Promise.resolve()),
  hasPasswordProvider: () => false,
  changePassword: vi.fn(() => Promise.resolve()),
  registerWithEmail: vi.fn(() => Promise.resolve()),
  signInWithGoogle: vi.fn(() => Promise.resolve()),
}));
vi.mock('@svtrip/core/supabase', () => ({ auth: { currentUser: null } }));
vi.mock('@svtrip/core/repos/exposureRepo', () => ({
  useExposure: () => ({ entries: [], loading: false }),
  clearExposure: async () => undefined,
  loadExposure: async () => [],
  recordShown: () => undefined,
  recordTakenUp: () => undefined,
  SEEN_LIMIT: 60,
}));
vi.mock('@svtrip/core/taxonomy/useTaxonomy', async () => {
  const { MOODS } = await import('@svtrip/shared');
  return {
    useMergedTaxonomy: () => ({
      keys: [...MOODS],
      label: (k: string) => k,
      icon: () => ({ kind: 'builtIn' as const, name: 'star' as const }),
    }),
    useTaxonomy: () => ({ entries: [], loading: false, reload: () => {} }),
    useScopedServices: () => ({ keys: [], label: (k: string) => k }),
  };
});
vi.mock('../src/shell/DesktopLayout', () => ({
  DesktopLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { ProfileScreen } = await import('../src/traveler/ProfileScreen');
const { RegisterScreen } = await import('../src/auth/RegisterScreen');

afterEach(cleanup);

const inRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('profile (FR-011, SC-008)', () => {
  it('carries both links and the version BELOW sign-out', () => {
    inRouter(<ProfileScreen />);
    const signOut = screen.getByRole('button', { name: /Cerrar sesión/ });
    const els = [
      screen.getByRole('link', { name: 'Política de privacidad' }),
      screen.getByRole('link', { name: 'Términos de servicio' }),
      screen.getByTestId('app-version'),
    ];
    for (const el of els) {
      expect(signOut.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(els[0].getAttribute('href')).toBe('/privacidad');
    expect(els[1].getAttribute('href')).toBe('/terminos');
  });

  it('shows the version the BUILD injected, not a literal', () => {
    // `web/vitest.config.ts` is its own config and does NOT inherit `vite.config.ts`'s `define`, so
    // `__APP_VERSION__` is absent here unless stubbed. A first draft of this case read it back and
    // compared — which asserted 'dev' against 'dev'. Two different injected values must give two
    // different screens; a hardcoded string in the component cannot.
    vi.stubGlobal('__APP_VERSION__', '7.3.1');
    inRouter(<ProfileScreen />);
    expect(screen.getByTestId('app-version').textContent).toContain('7.3.1');
    cleanup();
    vi.stubGlobal('__APP_VERSION__', '2.0');
    inRouter(<ProfileScreen />);
    expect(screen.getByTestId('app-version').textContent).toContain('2.0');
    expect(screen.getByTestId('app-version').textContent).not.toContain('7.3.1');
    vi.unstubAllGlobals();
  });
});

describe('registration (FR-015)', () => {
  it('links both documents before an account exists', () => {
    inRouter(<RegisterScreen />);
    expect(screen.getByRole('link', { name: 'Política de privacidad' }).getAttribute('href')).toBe('/privacidad');
    expect(screen.getByRole('link', { name: 'Términos de servicio' }).getAttribute('href')).toBe('/terminos');
  });
});
