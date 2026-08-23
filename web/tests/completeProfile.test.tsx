// The first-run completion step (feature 011, US2).
//
// Two things are pinned here that would be wrong rather than merely ugly:
//
//   1. A Google account is never shown a password field. It has none of the
//      product's own, so "current password" would have nothing to mean.
//   2. The step does NOT accept partial progress — unlike the profile screen,
//      which deliberately does. It exists to make the account complete; letting
//      it through half-done would land the traveler back here next visit having
//      achieved nothing.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@svtrip/core/i18n';

const saveProfileFields = vi.fn((_uid: string, _fields: Record<string, unknown>) =>
  Promise.resolve(),
);
let mockProfile: Record<string, unknown> = {};

vi.mock('@svtrip/core/auth/userProfile', () => ({
  saveProfileFields: (uid: string, fields: Record<string, unknown>) =>
    saveProfileFields(uid, fields),
  updatePreferences: vi.fn(() => Promise.resolve()),
}));

vi.mock('@svtrip/core/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { uid: 'traveler-1' }, profile: mockProfile, loading: false }),
}));

const { CompleteProfileScreen } = await import('../src/account/CompleteProfileScreen');

afterEach(cleanup);
beforeEach(() => {
  saveProfileFields.mockClear();
  mockProfile = {};
});

const input = (label: string) => screen.getByText(label).parentElement!.querySelector('input')!;
const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/**
 * Type into a controlled React input.
 *
 * `fireEvent.change` rather than assigning `.value`: React keeps its own record
 * of the last value it rendered, so a direct assignment looks like no change and
 * the handler never runs. fireEvent goes through the native setter AND wraps the
 * update in `act`, so the re-render lands before the next line — and the same
 * applies to clicks, which is why every interaction here goes through fireEvent
 * rather than the raw DOM `.click()`.
 */
function type(el: HTMLInputElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

describe('the completion step', () => {
  it('never offers a password field (FR-011)', () => {
    // The traveler arriving here signed in with Google. There is no password of
    // the product's own to set, and asking for one would be asking for their
    // Google password — which this product must never receive.
    const { container } = render(<CompleteProfileScreen />);
    expect(container.querySelectorAll('input[type="password"]').length).toBe(0);
  });

  it('pre-fills the names from what the provider supplied, still editable (FR-010)', () => {
    mockProfile = { displayName: 'Gustavo Carcamo' };
    render(<CompleteProfileScreen />);

    // Split on the first space: a guess the traveler can correct, which is the
    // whole point of leaving the fields editable rather than read-only.
    expect((input('Nombre') as HTMLInputElement).value).toBe('Gustavo');
    expect((input('Apellido') as HTMLInputElement).value).toBe('Carcamo');
    expect((input('Nombre') as HTMLInputElement).readOnly).toBe(false);
  });

  it('handles a single-word name without inventing a surname', () => {
    mockProfile = { displayName: 'Prince' };
    render(<CompleteProfileScreen />);
    expect((input('Nombre') as HTMLInputElement).value).toBe('Prince');
    expect((input('Apellido') as HTMLInputElement).value).toBe('');
  });

  it('defaults the country to El Salvador (FR-004)', () => {
    render(<CompleteProfileScreen />);
    const select = screen.getByText('País de residencia').parentElement!.querySelector('select')!;
    expect(select.value).toBe('SV');
    // Localized by the platform, not by a hand-maintained list of 249 names.
    expect(select.options[select.selectedIndex].text).toBe('El Salvador');
  });

  it('refuses to save while anything required is missing', () => {
    // Deliberately stricter than the profile screen. Partial progress here would
    // leave the account incomplete and bring the traveler straight back.
    mockProfile = { displayName: 'Gustavo Carcamo' };
    render(<CompleteProfileScreen />);

    click(/Guardar cambios/);
    expect(saveProfileFields).not.toHaveBeenCalled();
  });

  it('saves once every required field is present', () => {
    mockProfile = { displayName: 'Gustavo Carcamo' };
    render(<CompleteProfileScreen />);

    type(input('Edad') as HTMLInputElement, '41');
    click(/^Masculino$/);
    click(/Guardar cambios/);

    expect(saveProfileFields).toHaveBeenCalledWith(
      'traveler-1',
      expect.objectContaining({
        firstName: 'Gustavo',
        lastName: 'Carcamo',
        gender: 'masculine',
        age: 41,
        countryCode: 'SV',
      }),
    );
  });

  it('does not require marital status (FR-005)', () => {
    mockProfile = { displayName: 'Gustavo Carcamo' };
    render(<CompleteProfileScreen />);

    type(input('Edad') as HTMLInputElement, '41');
    click(/^Femenino$/);
    click(/Guardar cambios/);

    expect(saveProfileFields).toHaveBeenCalled();
    const saved = saveProfileFields.mock.calls[0]![1];
    expect(saved.maritalStatus).toBeUndefined();
  });
});
