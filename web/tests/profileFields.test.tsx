// The traveler's own details on the profile screen (feature 011, US3).
//
// The cases worth pinning here are the grandfathering ones. An account created
// before this feature has none of these fields, was never asked for them, and
// must never be blocked by them — while still being told what is missing, and
// still being held to the rules for any value it actually enters.
//
// Those three statements are only simultaneously true because the two validation
// layers are separate functions. `shared/tests/profile.test.ts` pins the
// functions; this pins the SCREEN honouring them.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@svtrip/core/i18n';

const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const saveProfileFields = vi.fn((_uid: string, _fields: Record<string, unknown>) =>
  Promise.resolve(),
);
let mockProfile: Record<string, unknown> = {};
let hasPassword = false;

vi.mock('@svtrip/core/auth/userProfile', () => ({
  saveProfileFields: (uid: string, fields: Record<string, unknown>) =>
    saveProfileFields(uid, fields),
  updatePreferences: vi.fn(() => Promise.resolve()),
}));

vi.mock('@svtrip/core/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'traveler-1', getIdTokenResult: () => Promise.resolve({ claims: {} }) },
    profile: mockProfile,
    loading: false,
  }),
}));

vi.mock('@svtrip/core/auth/authService', () => ({
  signOutUser: vi.fn(() => Promise.resolve()),
  hasPasswordProvider: () => hasPassword,
  changePassword: vi.fn(() => Promise.resolve()),
}));

vi.mock('@svtrip/core/taxonomy/useTaxonomy', async () => {
  const { MOODS } = await import('@svtrip/shared');
  return {
    useMergedTaxonomy: () => ({ keys: [...MOODS], label: (k: string) => k }),
    useTaxonomy: () => ({ entries: [], loading: false, reload: () => {} }),
    useScopedServices: () => ({ keys: [], label: (k: string) => k }),
  };
});

vi.mock('../src/shell/DesktopLayout', () => ({
  DesktopLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { ProfileScreen } = await import('../src/traveler/ProfileScreen');

afterEach(cleanup);
beforeEach(() => {
  saveProfileFields.mockClear();
  mockProfile = { displayName: 'Neto', email: 'n@example.com', preferences: { vibes: ['beach'] } };
  hasPassword = false;
});

const field = (label: string) =>
  screen.getByText(label).parentElement!.querySelector('input') as HTMLInputElement;
const type = (el: HTMLInputElement, value: string) =>
  fireEvent.change(el, { target: { value } });
const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/** A complete, post-011 profile. */
const complete = {
  profileVersion: 11,
  firstName: 'Neto',
  lastName: 'Mena',
  gender: 'masculine',
  age: 34,
  countryCode: 'SV',
};

describe('an account that predates the feature', () => {
  it('is told what is missing, and nothing is blocked', () => {
    // FR-019. The invitation names the gaps; it is a sentence on the page, not a
    // gate — the moods editor and sign-out are still right there.
    render(<ProfileScreen />);
    expect(screen.getByText(/faltan algunos datos/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Cerrar sesión/ })).toBeDefined();
  });

  it('can save partial progress, which is what makes the invitation actionable', () => {
    // FR-020. Six empty fields is a lot to face at once; refusing anything short
    // of all six would make the invitation a demand rather than an invitation.
    render(<ProfileScreen />);

    type(field('Nombre'), 'Neto');
    type(field('Apellido'), 'Mena');
    click(/Guardar cambios/);

    expect(saveProfileFields).toHaveBeenCalledWith(
      'traveler-1',
      expect.objectContaining({ firstName: 'Neto', lastName: 'Mena' }),
    );
  });

  it('is STILL refused an invalid value (FR-021)', () => {
    // The line that keeps grandfathering from becoming a hole in the rules.
    // Exempt from having to PROVIDE a field, never from validation of one being
    // provided now.
    render(<ProfileScreen />);

    type(field('Edad'), '200');
    click(/Guardar cambios/);

    expect(saveProfileFields).not.toHaveBeenCalled();
  });

  it('cannot type letters into age at all (FR-003)', () => {
    render(<ProfileScreen />);
    const age = field('Edad');
    type(age, 'treinta');
    expect(age.value).toBe('');
  });
});

describe('a completed account', () => {
  beforeEach(() => {
    mockProfile = { ...mockProfile, ...complete };
  });

  it('shows no invitation once nothing is missing (FR-019)', () => {
    render(<ProfileScreen />);
    expect(screen.queryByText(/faltan algunos datos/i)).toBeNull();
  });

  it('shows its stored values', () => {
    render(<ProfileScreen />);
    expect(field('Nombre').value).toBe('Neto');
    expect(field('Apellido').value).toBe('Mena');
    expect(field('Edad').value).toBe('34');
  });

  it('renders the email but offers no way to edit it (FR-014)', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('n@example.com')).toBeDefined();
    // Not merely disabled — there is no email input on the screen at all.
    const emailInputs = document.querySelectorAll('input[type="email"]');
    expect(emailInputs.length).toBe(0);
  });
});

describe('the password section', () => {
  it('is absent for an account with no password of the product\'s own (FR-011)', () => {
    // A Google account. "Current password" would have nothing to mean, so the
    // section does not exist rather than existing and refusing.
    hasPassword = false;
    render(<ProfileScreen />);
    expect(screen.queryByText(/Cambiar contraseña/)).toBeNull();
  });

  it('is offered to an account that has one', () => {
    hasPassword = true;
    render(<ProfileScreen />);
    expect(screen.getByText(/Cambiar contraseña/)).toBeDefined();
  });
});
