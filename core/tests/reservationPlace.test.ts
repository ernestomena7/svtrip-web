// Where a reservation is (2026-10-23). NEW FILE.
//
// Feature 020 shipped every reservation display — Explorar's card, "Mis reservas", the merchant's
// inbox, on phone and desktop — showing date and state but never the place. The product owner caught
// it on the phone. The name now arrives WITH the reservation (joined through the listing), and these
// cases pin the two things a display relies on: the reader's language, and an honest empty when the
// name cannot be read (the display then keeps its old date-first layout).
import { describe, it, expect, vi } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));

const { withPlace } = await import('../src/repos/reservationsRepo');
const { reservationPlaceName } = await import('@svtrip/shared');

const row = (listings: unknown) => ({
  id: 'r1', listing_id: 'el-barrilon', traveler_uid: 't', merchant_uid: 'm', at: '2026-10-30T18:21', people: 2,
  contact_name: 'Ana', contact_email: 'a@x.test', recorded: 'confirmed',
  created_at: '2026-10-23T00:00:00.000Z', updated_at: '2026-10-23T00:00:00.000Z', listings,
});

describe('the place a reservation is for', () => {
  it('comes through the join, and the join does not leak into the reservation', () => {
    const r = withPlace(row({ name: 'El Barrilon', name_i18n: { es: 'El Barrilón', en: 'El Barrilon' } }));
    expect(r.placeName).toBe('El Barrilon');
    expect(r.placeNameI18n).toEqual({ es: 'El Barrilón', en: 'El Barrilon' });
    expect(r).not.toHaveProperty('listings');
    expect(r.reservationId).toBe('r1');
  });

  it('is shown in the reader’s language', () => {
    const r = withPlace(row({ name: 'Lago', name_i18n: { es: 'Lago de Coatepeque', en: 'Lake Coatepeque' } }));
    expect(reservationPlaceName(r, 'es')).toBe('Lago de Coatepeque');
    expect(reservationPlaceName(r, 'en')).toBe('Lake Coatepeque');
  });

  it('falls back to the plain name for a listing that has no translations', () => {
    expect(reservationPlaceName(withPlace(row({ name: 'Suchitoto', name_i18n: null })), 'en')).toBe('Suchitoto');
  });

  it('is empty — never invented — when the listing cannot be read', () => {
    expect(reservationPlaceName(withPlace(row(null)), 'es')).toBe('');
    expect(reservationPlaceName(withPlace(row(undefined)), 'es')).toBe('');
  });
});
