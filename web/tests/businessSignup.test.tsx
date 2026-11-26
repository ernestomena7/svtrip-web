// Feature 025 (T019, T028a): the merchant enrolment in the web app.
//
// The ROUTER and the SCREENS are real — including the first-run gates, because the failure this file
// exists for (research R1a) lives in their order: an account exists the instant Step 1 signs up, and a
// screen registered "in both route trees" still sits below the profile and mood gates. Only the network,
// the map, the uploader and the taxonomy fetch are stubbed.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@svtrip/core/i18n';
import { MOODS, currentLegalVersions } from '@svtrip/shared';

const stub = (label: string) => () => <div>{label}</div>;
vi.mock('../src/account/ChooseMoodsScreen', () => ({ ChooseMoodsScreen: stub('CHOOSE_MOODS') }));
vi.mock('../src/account/CompleteProfileScreen', () => ({ CompleteProfileScreen: stub('COMPLETE_PROFILE') }));
vi.mock('../src/business/MyBusinessesScreen', () => ({ MyBusinessesScreen: stub('MY_BUSINESSES') }));
vi.mock('../src/business/DashboardScreen', () => ({ DashboardScreen: stub('DASHBOARD') }));
vi.mock('../src/traveler/DiscoverScreen', () => ({ DiscoverScreen: stub('DISCOVER') }));
vi.mock('../src/public/PreviewScreen', () => ({ PreviewScreen: stub('PREVIEW') }));
vi.mock('@svtrip/core/apiClient', () => ({ postJson: vi.fn(async () => ({ ok: true })), getJson: vi.fn() }));
vi.mock('@svtrip/core/TaxonomyGlyph', () => ({ TaxonomyGlyph: () => null }));
vi.mock('@svtrip/core/taxonomy/useTaxonomy', () => ({
  useTaxonomy: () => ({ entries: [], loading: false }),
  useMergedTaxonomy: (_v: string, builtIn: readonly string[]) => ({ keys: [...builtIn], label: (k: string) => `label:${k}`, icon: () => null }),
  invalidateTaxonomy: () => {},
}));
vi.mock('../src/business/LocationPicker', () => ({
  DEFAULT_CENTER: { lat: 13.6962, lng: -89.2015 },
  LocationPicker: ({ onChange }: { onChange: (n: { lat: string; lng: string }) => void }) => (
    <button type="button" onClick={() => onChange({ lat: '13.67', lng: '-89.28' })}>
      PLACE_PIN
    </button>
  ),
}));
vi.mock('../src/business/MediaManager', () => ({
  MediaManager: ({ urls, onChange }: { urls: string[]; onChange: (u: string[]) => void }) => (
    <button type="button" onClick={() => onChange([...urls, 'https://x/media/listings/u1/p.jpg'])}>
      ADD_PHOTO ({urls.length})
    </button>
  ),
}));

const repo = {
  fetchMyRegistration: vi.fn(),
  countOwnedListings: vi.fn(),
  submitBusinessSignup: vi.fn(),
  reverseGeocode: vi.fn(async () => ({ label: 'Antiguo Cuscatlán', municipality: 'Antiguo Cuscatlán' })),
};
vi.mock('@svtrip/core/repos/businessSignupRepo', () => repo);

const authApi = { registerWithEmail: vi.fn(), signInWithGoogle: vi.fn() };
vi.mock('@svtrip/core/auth/authService', () => authApi);
const profileApi = { saveProfileFields: vi.fn(async () => {}), recordTermsAcceptance: vi.fn(async () => {}), updatePreferences: vi.fn(async () => {}), completeOnboarding: vi.fn() };
vi.mock('@svtrip/core/auth/userProfile', () => profileApi);
const sessionState = { currentUser: null as null | { uid: string } };
vi.mock('@svtrip/core/supabase', () => ({ auth: sessionState, supabase: {} }));

const versions = currentLegalVersions();
const completeProfile = {
  uid: 'u1',
  firstName: 'Ana',
  lastName: 'López',
  gender: 'feminine',
  age: 34,
  countryCode: 'SV',
  onboardingComplete: false,
  profileVersion: 2,
  termsVersion: versions.terms,
  privacyVersion: versions.privacy,
};
const authState = { user: null as null | { uid: string }, profile: null as Record<string, unknown> | null, loading: false };
vi.mock('@svtrip/core/auth/AuthProvider', () => ({ useAuth: () => authState }));

const { Router } = await import('../src/app/Router');
const { useUiStore } = await import('@svtrip/core/uiStore');

function renderAt(path: string) {
  window.history.pushState({}, '', path);
  return render(<Router />);
}

beforeEach(() => {
  authState.user = null;
  authState.profile = null;
  authState.loading = false;
  sessionState.currentUser = null;
  sessionStorage.clear();
  useUiStore.getState().setPersona('traveler');
  useUiStore.getState().setLanguage('es');
  repo.fetchMyRegistration.mockResolvedValue(null);
  repo.countOwnedListings.mockResolvedValue(0);
  repo.submitBusinessSignup.mockReset();
  authApi.registerWithEmail.mockReset();
  authApi.signInWithGoogle.mockReset();
  profileApi.saveProfileFields.mockClear();
  profileApi.recordTermsAcceptance.mockClear();
  profileApi.updatePreferences.mockClear();
});
afterEach(cleanup);

describe('routing (contracts/pages.md)', () => {
  it('signed out → Step 1, "Paso 1 de 2", no Traveler/Merchant choice', async () => {
    renderAt('/negocios/registro');
    expect(await screen.findByText('Paso 1 de 2')).toBeTruthy();
    expect(screen.queryByText(/viajero/i)).toBeNull();
  });

  it('signed in with a registration → its confirmation, never a second Step 2', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
    repo.fetchMyRegistration.mockResolvedValue({ listingId: 'l1', promotionApplied: true, freeUntil: Date.parse('2027-03-15T16:00:00Z') });
    renderAt('/negocios/registro');
    expect(await screen.findByTestId('signup-confirmation-promotion')).toBeTruthy();
    expect(screen.queryByText('Paso 2 de 2')).toBeNull();
  });

  it('signed in, profile incomplete (a Google return) → "Completá tus datos", no password fields', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = { uid: 'u1', firstName: 'Ana', onboardingComplete: false, profileVersion: 2 };
    renderAt('/negocios/registro');
    expect(await screen.findByText('Completá tus datos')).toBeTruthy();
    expect(screen.queryByLabelText(/contraseña/i)).toBeNull();
  });

  it('signed in, complete profile → Step 2', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
    renderAt('/negocios/registro');
    expect(await screen.findByText('Paso 2 de 2')).toBeTruthy();
  });

  it('an existing merchant sees that the business joins their account and plan', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
    repo.countOwnedListings.mockResolvedValue(2);
    renderAt('/negocios/registro');
    expect(await screen.findByText(/se suma a tu cuenta/)).toBeTruthy();
  });

  it('/en/business/register renders in English', async () => {
    renderAt('/en/business/register');
    expect(await screen.findByText('Step 1 of 2')).toBeTruthy();
  });
});

describe('the first-run gates do not stand in the way (R1a, T028a)', () => {
  it('a brand-new account with an EMPTY profile on the signup path sees the signup screen — not the gates', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = { uid: 'u1', onboardingComplete: false, profileVersion: 2 };
    renderAt('/negocios/registro');
    expect(await screen.findByText('Completá tus datos')).toBeTruthy();
    expect(screen.queryByText('COMPLETE_PROFILE')).toBeNull();
    expect(screen.queryByText('CHOOSE_MOODS')).toBeNull();
  });

  it('after enrolling, merchant mode with onboardingComplete:false reaches the business, not the moods screen', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
    useUiStore.getState().setPersona('provider');
    renderAt('/businesses');
    expect(await screen.findByText('MY_BUSINESSES')).toBeTruthy();
    expect(screen.queryByText('CHOOSE_MOODS')).toBeNull();
  });

  it('the same account in TRAVELER mode IS asked for moods (the allow beside the deny)', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
    renderAt('/discover');
    expect(await screen.findByText('CHOOSE_MOODS')).toBeTruthy();
  });
});

describe('Step 1', () => {
  it('"Continuar" stays disabled until the terms box is checked (FR-012)', async () => {
    renderAt('/negocios/registro');
    const button = (await screen.findByRole('button', { name: 'Continuar' })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(screen.getByTestId('signup-terms'));
    expect(button.disabled).toBe(true); // the password is still empty
  });

  it('Google writes the origin and language to sessionStorage before leaving (R1b)', async () => {
    authApi.signInWithGoogle.mockImplementation(() => new Promise(() => {}));
    renderAt('/negocios/registro?src=Invitacion-DIC&lang=es');
    fireEvent.click(await screen.findByRole('button', { name: /google/i }));
    expect(JSON.parse(sessionStorage.getItem('svtrip-signup')!)).toEqual({ origin: 'invitacion-dic', lang: 'es' });
  });

  it('completing the profile records the CURRENT terms versions and switches to merchant mode', async () => {
    // A Google return: everything but the last name (Google gave a first name only).
    authState.user = { uid: 'u1' };
    authState.profile = { uid: 'u1', firstName: 'Ana', gender: 'feminine', age: 34, countryCode: 'SV', onboardingComplete: false, profileVersion: 2 };
    sessionState.currentUser = { uid: 'u1' };
    renderAt('/negocios/registro');
    await screen.findByText('Completá tus datos');
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'López' } });
    fireEvent.click(screen.getByTestId('signup-terms'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() =>
      expect(profileApi.recordTermsAcceptance).toHaveBeenCalledWith('u1', { termsVersion: versions.terms, privacyVersion: versions.privacy }),
    );
    expect(profileApi.saveProfileFields).toHaveBeenCalled();
    expect(useUiStore.getState().persona).toBe('provider');
    // The live profile copy is deliberately left STALE here (authState.profile never changes), as it was
    // on a local stack with no realtime: the merchant must reach Step 2 anyway, not see Step 1 again with
    // every field filled in after the data was saved.
    expect(await screen.findByText('Paso 2 de 2')).toBeTruthy();
    expect(screen.queryByText('Completá tus datos')).toBeNull();
  });
});

describe('the page language becomes the account language (T033)', () => {
  // The bug: a new profile is born with language 'es' and the app copies a profile's language back over the
  // screen's, so an English merchant's Step 2 came up in Spanish. The deny (en -> 'en') sits beside the
  // allow (es -> 'es'): a fix that always wrote one value would pass only one of the two.
  async function submitAsGoogleReturn(path: string) {
    authState.user = { uid: 'u1' };
    authState.profile = { uid: 'u1', firstName: 'Ana', gender: 'feminine', age: 34, countryCode: 'SV', onboardingComplete: false, profileVersion: 2 };
    sessionState.currentUser = { uid: 'u1' };
    renderAt(path);
    const terms = await screen.findByTestId('signup-terms');
    fireEvent.change(screen.getByLabelText(/^(Apellido|Last name)$/), { target: { value: 'Lopez' } });
    fireEvent.click(terms);
    fireEvent.click(screen.getByRole('button', { name: /^(Continuar|Continue)$/ }));
    await waitFor(() => expect(profileApi.recordTermsAcceptance).toHaveBeenCalled());
  }

  it('on the English page the account is saved as English', async () => {
    await submitAsGoogleReturn('/en/business/register');
    await waitFor(() => expect(profileApi.updatePreferences).toHaveBeenCalledWith('u1', { language: 'en' }));
  });

  it('on the Spanish page the account is saved as Spanish', async () => {
    await submitAsGoogleReturn('/negocios/registro');
    await waitFor(() => expect(profileApi.updatePreferences).toHaveBeenCalledWith('u1', { language: 'es' }));
  });

  it('a failing preference write never undoes the registration', async () => {
    profileApi.updatePreferences.mockRejectedValueOnce(new Error('offline'));
    await submitAsGoogleReturn('/en/business/register');
    expect(await screen.findByText('Step 2 of 2')).toBeTruthy();
  });
});

describe('Step 1 is ONE screen (the reported bug)', () => {
  it('while the account is being created, the full form stays — no short "Completá tus datos" screen, no spinner — and Step 2 follows', async () => {
    const seen: string[] = [];
    authApi.registerWithEmail.mockImplementation(async () => {
      // The account now exists and the session is known, exactly as in production (auto-confirm).
      authState.user = { uid: 'u1' };
      sessionState.currentUser = { uid: 'u1' };
      await i18n.changeLanguage('en'); // force the parent to re-render mid-submit
      await i18n.changeLanguage('es');
    });
    profileApi.saveProfileFields.mockImplementation(async () => {
      seen.push(document.body.textContent ?? '');
    });
    renderAt('/negocios/registro');
    await screen.findByText('Paso 1 de 2');
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@test.com' } });
    const pw = screen.getAllByLabelText(/contraseña/i);
    fireEvent.change(pw[0], { target: { value: 'password-123' } });
    fireEvent.change(pw[1], { target: { value: 'password-123' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'López' } });
    fireEvent.change(screen.getByLabelText('Edad'), { target: { value: '34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Femenino' }));
    fireEvent.click(screen.getByTestId('signup-terms'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await waitFor(() => expect(profileApi.saveProfileFields).toHaveBeenCalled());
    // Mid-submit, with the user already signed in:
    expect(seen[0]).toContain('Creá tu cuenta');
    expect(seen[0]).not.toContain('Completá tus datos');
    expect(await screen.findByText('Paso 2 de 2')).toBeTruthy();
  });
});

describe('the funnel (US4) — counts only, sent once, never breaking the form', () => {
  const sent = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)));
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 204 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('the first field focus counts step1_started with the link origin — and only once', async () => {
    renderAt('/negocios/registro?src=Invitacion-DIC');
    await screen.findByText('Paso 1 de 2');
    fireEvent.focus(screen.getByLabelText('Correo'));
    fireEvent.focus(screen.getByLabelText('Nombre'));
    expect(sent()).toEqual([{ step: 'step1_started', origin: 'invitacion-dic' }]);
  });

  it('the Google button also counts it, so a Google merchant is not counted as finishing a step they never started (U5)', async () => {
    authApi.signInWithGoogle.mockImplementation(() => new Promise(() => {}));
    renderAt('/negocios/registro?src=mail');
    fireEvent.click(await screen.findByRole('button', { name: /google/i }));
    expect(sent()).toEqual([{ step: 'step1_started', origin: 'mail' }]);
  });

  it('a failing network never breaks the form', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    renderAt('/negocios/registro');
    await screen.findByText('Paso 1 de 2');
    expect(() => fireEvent.focus(screen.getByLabelText('Correo'))).not.toThrow();
  });

  it('the event carries nothing but a step and an origin — no email, name or address', async () => {
    renderAt('/negocios/registro?src=mail');
    await screen.findByText('Paso 1 de 2');
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@test.com' } });
    fireEvent.focus(screen.getByLabelText('Correo'));
    expect(Object.keys(sent()[0]).sort()).toEqual(['origin', 'step']);
    expect(JSON.stringify(sent())).not.toContain('ana@test.com');
  });
});

describe('Step 2', () => {
  beforeEach(() => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
    sessionState.currentUser = { uid: 'u1' };
  });

  it('the description counter refuses the 301st character', async () => {
    renderAt('/negocios/registro');
    const area = (await screen.findByTestId('signup-description')) as HTMLTextAreaElement;
    fireEvent.change(area, { target: { value: 'x'.repeat(320) } });
    expect(area.value).toHaveLength(300);
    expect(screen.getByTestId('signup-description-count').textContent).toBe('300/300');
  });

  // FR-011 NOTE (2026-11-25, product owner): this case was 'one mood only: choosing a second replaces
  // the first'. A business can carry SEVERAL moods, as its own listing form already allows — the HU's
  // "una sola" is superseded. Inverted, not deleted: choosing a second now ADDS it, and choosing a chosen
  // one removes it.
  it('several moods: each tap toggles one, and every chosen one stays chosen', async () => {
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    const pressed = () => screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true' && b.textContent?.startsWith('label:')).map((b) => b.textContent);
    fireEvent.click(screen.getByRole('button', { name: `label:${MOODS[0]}` }));
    fireEvent.click(screen.getByRole('button', { name: `label:${MOODS[1]}` }));
    fireEvent.click(screen.getByRole('button', { name: `label:${MOODS[2]}` }));
    expect(pressed()).toEqual([`label:${MOODS[0]}`, `label:${MOODS[1]}`, `label:${MOODS[2]}`]);
    fireEvent.click(screen.getByRole('button', { name: `label:${MOODS[1]}` })); // tap again → off
    expect(pressed()).toEqual([`label:${MOODS[0]}`, `label:${MOODS[2]}`]);
  });

  it('every chosen mood is sent, in the order chosen', async () => {
    repo.submitBusinessSignup.mockResolvedValue({ listingId: 'l1', visible: true, promotion: null, welcomeEmail: 'pending' });
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    fireEvent.change(screen.getByLabelText('Nombre del negocio'), { target: { value: 'Café La Ceiba' } });
    fireEvent.click(screen.getByRole('button', { name: `label:${MOODS[2]}` }));
    fireEvent.click(screen.getByRole('button', { name: `label:${MOODS[0]}` }));
    const typeButtons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'false' && !b.textContent?.startsWith('label:'));
    fireEvent.click(typeButtons[0]);
    fireEvent.click(screen.getByText(/ADD_PHOTO/));
    fireEvent.change(screen.getByTestId('signup-description'), { target: { value: 'Pupusas.' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '+503 7000 0000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Registrar mi negocio' }));
    });
    expect((repo.submitBusinessSignup.mock.calls[0][0] as { moods: string[] }).moods).toEqual([MOODS[2], MOODS[0]]);
  });

  it('with no mood chosen the field is flagged and nothing is sent', async () => {
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Registrar mi negocio' }));
    });
    expect(await screen.findByTestId('error-moods')).toBeTruthy();
    expect(repo.submitBusinessSignup).not.toHaveBeenCalled();
  });

  it('a draft saved with the old single `mood` keeps that choice', async () => {
    sessionStorage.setItem('svtrip-signup-draft', JSON.stringify({ mood: MOODS[3] }));
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    expect(screen.getByRole('button', { name: `label:${MOODS[3]}` }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a server refusal marks the fields it names and keeps what was typed (FR-015)', async () => {
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    fireEvent.change(screen.getByLabelText('Nombre del negocio'), { target: { value: 'Café La Ceiba' } });
    fireEvent.click(screen.getByRole('button', { name: `label:${MOODS[0]}` }));
    // The type picker is real; pick its first option.
    const typeButtons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'false' && !b.textContent?.startsWith('label:'));
    fireEvent.click(typeButtons[0]);
    fireEvent.click(screen.getByText('PLACE_PIN'));
    fireEvent.click(screen.getByText(/ADD_PHOTO/));
    fireEvent.change(screen.getByTestId('signup-description'), { target: { value: 'Pupusas.' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '+503 7000 0000' } });
    repo.submitBusinessSignup.mockRejectedValue(
      Object.assign(new Error('Invalid body'), { status: 400, code: 'invalid_body', details: { issues: [{ path: 'description', message: 'x' }] } }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Registrar mi negocio' }));
    });
    // No branch: the submit MUST have happened, or this case would pass without testing FR-015.
    expect(repo.submitBusinessSignup).toHaveBeenCalledTimes(1);
    expect(await screen.findByTestId('error-description')).toBeTruthy();
    expect((screen.getByLabelText('Nombre del negocio') as HTMLInputElement).value).toBe('Café La Ceiba');
    expect((screen.getByTestId('signup-description') as HTMLTextAreaElement).value).toBe('Pupusas.');
  });

  it('San Salvador is the starting location: a merchant who never touches the pin is not told to place one', async () => {
    repo.submitBusinessSignup.mockResolvedValue({ listingId: 'l1', visible: true, promotion: null, welcomeEmail: 'pending' });
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    fireEvent.change(screen.getByLabelText('Nombre del negocio'), { target: { value: 'Café La Ceiba' } });
    fireEvent.click(screen.getByRole('button', { name: `label:${MOODS[0]}` }));
    const typeButtons = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'false' && !b.textContent?.startsWith('label:'));
    fireEvent.click(typeButtons[0]);
    fireEvent.click(screen.getByText(/ADD_PHOTO/));
    fireEvent.change(screen.getByTestId('signup-description'), { target: { value: 'Pupusas.' } });
    fireEvent.change(screen.getByLabelText('WhatsApp'), { target: { value: '+503 7000 0000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Registrar mi negocio' }));
    });
    expect(repo.submitBusinessSignup).toHaveBeenCalledTimes(1);
    const sent = repo.submitBusinessSignup.mock.calls[0][0] as { location: { lat: number; lng: number } };
    expect(sent.location.lat).toBeCloseTo(13.6962, 4);
    expect(sent.location.lng).toBeCloseTo(-89.2015, 4);
    expect(screen.queryByTestId('error-location')).toBeNull();
  });

  it('a line asks the merchant to move the pin until they do (option B)', async () => {
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    expect(screen.getByTestId('signup-pin-hint').textContent).toMatch(/pin/i);
    fireEvent.click(screen.getByText('PLACE_PIN'));
    expect(screen.queryByTestId('signup-pin-hint')).toBeNull();
  });

  it('a restored draft whose pin was already set shows no line', async () => {
    sessionStorage.setItem('svtrip-signup-draft', JSON.stringify({ lat: '13.5', lng: '-89.3', pinSet: true }));
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    expect(screen.queryByTestId('signup-pin-hint')).toBeNull();
  });

  it('an account without the current terms sees the box on Step 2 and cannot submit without it (R12a)', async () => {
    authState.profile = { ...completeProfile, termsVersion: '2001-01-01' };
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    expect(screen.getByTestId('signup-terms')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Registrar mi negocio' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('with the current terms there is no box', async () => {
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    expect(screen.queryByTestId('signup-terms')).toBeNull();
  });
});

describe('the confirmation tells the truth (FR-008, FR-019)', () => {
  beforeEach(() => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
  });

  it('promotion: the El Salvador date, and a way to the business', async () => {
    repo.fetchMyRegistration.mockResolvedValue({ listingId: 'l1', promotionApplied: true, freeUntil: Date.parse('2027-04-30T16:00:00Z') });
    renderAt('/negocios/registro');
    expect(await screen.findByText(/30 de abril de 2027/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ir a mi negocio' }).getAttribute('href')).toBe('/businesses');
  });

  it('registered without a promotion: no promise of visibility', async () => {
    repo.fetchMyRegistration.mockResolvedValue({ listingId: 'l1', promotionApplied: false });
    renderAt('/negocios/registro');
    expect(await screen.findByTestId('signup-confirmation-registered')).toBeTruthy();
    expect(screen.queryByText(/ya lo pueden encontrar/)).toBeNull();
  });
});

describe('US2 — coming back without losing my place (T034, T036)', () => {
  const fillStep1 = async () => {
    await screen.findByText('Paso 1 de 2');
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'ana@test.com' } });
    const pw = screen.getAllByLabelText(/contraseña/i);
    fireEvent.change(pw[0], { target: { value: 'password-123' } });
    fireEvent.change(pw[1], { target: { value: 'password-123' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'López' } });
    fireEvent.change(screen.getByLabelText('Edad'), { target: { value: '34' } });
    fireEvent.click(screen.getByRole('button', { name: 'Femenino' }));
    fireEvent.click(screen.getByTestId('signup-terms'));
  };

  it('an email that already has an account: ONE sign-up attempt, the generic message, and a way in that returns to the form (FR-013)', async () => {
    authApi.registerWithEmail.mockRejectedValue(Object.assign(new Error('User already registered'), { code: 'user_already_exists', status: 422 }));
    renderAt('/negocios/registro');
    await fillStep1();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    });
    await waitFor(() => expect(authApi.registerWithEmail).toHaveBeenCalledTimes(1));
    // The message is the SAME generic one a failed sign-up always shows — it never says the email exists (feature 003).
    expect(screen.queryByText(/ya existe|already exists|ya está registrad/i)).toBeNull();
    // Inside the ERROR region, not the footer: the footer always carries a sign-in link, and asserting on
    // it alone would pass without the error path ever offering one.
    const alert = await screen.findByRole('alert');
    const link = alert.querySelector('a')!;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe('/sign-in?next=%2Fnegocios%2Fregistro');
    expect(profileApi.saveProfileFields).not.toHaveBeenCalled(); // no second account, no half-saved profile
  });

  it('the English page returns to the English form after signing in', async () => {
    renderAt('/en/business/register');
    const link = (await screen.findAllByRole('link', { name: 'Sign in' })).pop()!;
    expect(link.getAttribute('href')).toBe('/sign-in?next=%2Fen%2Fbusiness%2Fregister');
  });

  it('Step 2 restores the draft after a reload (T036)', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
    sessionStorage.setItem('svtrip-signup-draft', JSON.stringify({ name: 'Café La Ceiba', description: 'Pupusas.' }));
    renderAt('/negocios/registro');
    await screen.findByText('Paso 2 de 2');
    expect((screen.getByLabelText('Nombre del negocio') as HTMLInputElement).value).toBe('Café La Ceiba');
    expect((screen.getByTestId('signup-description') as HTMLTextAreaElement).value).toBe('Pupusas.');
  });

  it('a finished registration clears the draft, so a second visit does not offer old answers', async () => {
    authState.user = { uid: 'u1' };
    authState.profile = completeProfile;
    sessionStorage.setItem('svtrip-signup-draft', JSON.stringify({ name: 'Viejo' }));
    repo.fetchMyRegistration.mockResolvedValue({ listingId: 'l1', promotionApplied: false });
    renderAt('/negocios/registro');
    await screen.findByTestId('signup-confirmation-registered');
    expect(screen.queryByText('Paso 2 de 2')).toBeNull();
  });
});
