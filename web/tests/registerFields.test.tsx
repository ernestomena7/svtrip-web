// Registration with an email address (feature 011, US1).
//
// The property that matters most here is negative: an account is NOT created
// while anything is missing or mismatched. Creating it first and collecting the
// rest afterwards would leave a half-made account behind every abandoned form —
// and the traveler could not simply retry, because the email would already be
// taken.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@svtrip/core/i18n';

const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const registerWithEmail = vi.fn((_email: string, _password: string) => Promise.resolve());
const saveProfileFields = vi.fn((_uid: string, _fields: Record<string, unknown>) =>
  Promise.resolve(),
);
const signInWithGoogle = vi.fn(() => Promise.resolve());

vi.mock('@svtrip/core/auth/authService', () => ({
  registerWithEmail: (e: string, p: string) => registerWithEmail(e, p),
  signInWithGoogle: () => signInWithGoogle(),
}));
vi.mock('@svtrip/core/auth/userProfile', () => ({
  saveProfileFields: (uid: string, fields: Record<string, unknown>) =>
    saveProfileFields(uid, fields),
}));
vi.mock('@svtrip/core/firebase', () => ({ auth: { currentUser: { uid: 'new-uid' } } }));

const { RegisterScreen } = await import('../src/auth/RegisterScreen');

afterEach(cleanup);
beforeEach(() => {
  registerWithEmail.mockClear();
  saveProfileFields.mockClear();
  signInWithGoogle.mockClear();
});

const field = (label: string) =>
  screen.getByText(label).parentElement!.querySelector('input') as HTMLInputElement;
const type = (el: HTMLInputElement, value: string) =>
  fireEvent.change(el, { target: { value } });
const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

/** Fill everything the form needs, then let each test spoil one thing. */
function fillValid() {
  type(field('Correo'), 'nuevo@example.com');
  type(field('Contraseña'), 'unaClaveLarga1');
  type(field('Confirmar contraseña'), 'unaClaveLarga1');
  type(field('Nombre'), 'Gustavo');
  type(field('Apellido'), 'Carcamo');
  type(field('Edad'), '41');
  click(/^Masculino$/);
}

describe('registering with an email address', () => {
  beforeEach(() => render(<RegisterScreen />));

  it('creates the account and stores the details together', async () => {
    fillValid();
    click(/Crear cuenta/);

    expect(registerWithEmail).toHaveBeenCalledWith('nuevo@example.com', 'unaClaveLarga1');
    // The details land immediately AFTER creation, so this has to wait for that
    // await to resolve — the account is never observable in an incomplete state,
    // but it is briefly observable to a synchronous assertion.
    await waitFor(() =>
      expect(saveProfileFields).toHaveBeenCalledWith(
      'new-uid',
      expect.objectContaining({
        firstName: 'Gustavo',
        lastName: 'Carcamo',
        gender: 'masculine',
        age: 41,
        countryCode: 'SV',
      }),
      ),
    );
  });

  it('creates NOTHING when a required detail is missing (FR-006, FR-007)', () => {
    type(field('Correo'), 'nuevo@example.com');
    type(field('Contraseña'), 'unaClaveLarga1');
    type(field('Confirmar contraseña'), 'unaClaveLarga1');
    // No name, gender or age.
    click(/Crear cuenta/);

    // The account must not exist. A traveler who abandons this form has to be
    // able to come back to the same email address.
    expect(registerWithEmail).not.toHaveBeenCalled();
  });

  it('creates NOTHING when the passwords differ (FR-008)', () => {
    fillValid();
    type(field('Confirmar contraseña'), 'otraClaveLarga1');
    click(/Crear cuenta/);

    expect(registerWithEmail).not.toHaveBeenCalled();
    expect(screen.getByText(/no coinciden/i)).toBeDefined();
  });

  it('refuses letters in the age field outright (FR-003)', () => {
    const age = field('Edad');
    type(age, 'cuarenta');
    expect(age.value).toBe('');
  });

  it('offers El Salvador already selected (FR-004)', () => {
    const select = screen.getByText('País de residencia').parentElement!.querySelector('select')!;
    expect(select.value).toBe('SV');
    // 249 countries, none of them written into a locale file.
    expect(select.options.length).toBeGreaterThan(200);
  });

  it('does not require marital status (FR-005)', () => {
    fillValid();
    click(/Crear cuenta/);
    expect(registerWithEmail).toHaveBeenCalled();
  });
});

describe('registering with Google', () => {
  beforeEach(() => render(<RegisterScreen />));

  it('is offered on this screen, not only on sign-in', () => {
    // Without it, the only way to start an account with Google was to go to a
    // screen labelled "sign in" — which reads as "you already have one".
    expect(screen.getByRole('button', { name: /Continuar con Google/ })).toBeDefined();
  });

  it('asks for none of the six fields here', async () => {
    // They are collected by the first-run completion step instead, which this
    // account passes through anyway and which pre-fills from what Google gave.
    // Demanding them here would mean asking twice.
    click(/Continuar con Google/);
    // Awaited BEFORE the negative assertion. `click` only queues the handler:
    // a save that happens one microtask later had not run yet when the old
    // version asserted, so `not.toHaveBeenCalled()` passed whether the screen
    // saved fields or not. A negative assertion is only worth what the thing
    // it waits for is worth.
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
    expect(saveProfileFields).not.toHaveBeenCalled();
  });

  it('does not create an email account as a side effect', () => {
    click(/Continuar con Google/);
    expect(registerWithEmail).not.toHaveBeenCalled();
  });
});
