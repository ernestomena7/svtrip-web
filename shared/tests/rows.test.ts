// The generic row ⇄ app converter (feature 023, core/src/db/rows.ts).
//
// Every repo reads and writes through these two functions, so a mistake here is a mistake on every
// screen at once. The names that do NOT follow the snake/camel rule, the id field per table, the
// instants, and the structural parent keys are each pinned by a case of their own.
import { describe, it, expect } from 'vitest';
import { fromRow, toRow } from '../src/db/rows.js';

const at = (ms: number) => new Date(ms).toISOString();

describe('toRow', () => {
  it('maps camelCase to snake_case, including the I18n and URL names', () => {
    expect(toRow('listings', { nameI18n: { es: 'a' }, bannerURL: 'u', colonialTown: true, priceBand: '$$' })).toEqual({
      name_i18n: { es: 'a' },
      banner_url: 'u',
      colonial_town: true,
      price_band: '$$',
    });
  });

  it('writes the id field to `id` (or `key` / `code` where the table says so)', () => {
    expect(toRow('listings', { listingId: 'el-tunco' })).toEqual({ id: 'el-tunco' });
    expect(toRow('moods', { key: 'beach' })).toEqual({ key: 'beach' });
    expect(toRow('subscription_plans', { code: 'premium' })).toEqual({ code: 'premium' });
  });

  it('converts epoch ms to ISO for instant columns only', () => {
    expect(toRow('shown', { shownAt: 5, takenUpAt: 9, shownCount: 2 })).toEqual({
      shown_at: at(5),
      taken_up_at: at(9),
      shown_count: 2,
    });
  });

  it('leaves a CalendarDay or a local moment as the text it is', () => {
    // A Trip's start date and a reservation's `at` are not instants (features 016, 020).
    expect(toRow('trips', { startDate: '2026-10-10' })).toEqual({ start_date: '2026-10-10' });
    expect(toRow('reservations', { at: '2026-12-01T20:00' })).toEqual({ at: '2026-12-01T20:00' });
  });

  it('OMITS undefined — a partial save must not clear what it did not mention', () => {
    expect(toRow('listings', { name: 'x', phone: undefined })).toEqual({ name: 'x' });
  });

  it('KEEPS an explicit null — that is a deliberate clear', () => {
    expect(toRow('trip_stops', { date: null })).toEqual({ date: null });
  });
});

describe('fromRow', () => {
  it('maps back, null columns become ABSENT fields (as Firestore documents had them)', () => {
    const listing = fromRow<Record<string, unknown>>('listings', {
      id: 'el-tunco', name_i18n: { es: 'a' }, banner_url: 'u', covered: null, reservations_enabled: null, created_at: at(7),
    });
    expect(listing).toEqual({ listingId: 'el-tunco', nameI18n: { es: 'a' }, bannerURL: 'u', createdAt: 7 });
    // The two opposite-default fields both stay ABSENT, never false: `covered !== false` reads a
    // legacy listing as VISIBLE and `reservationsEnabled === true` reads it as OFF (features 018, 020).
    expect('covered' in listing).toBe(false);
    expect('reservationsEnabled' in listing).toBe(false);
  });

  it('drops structural parent keys the app value never carried', () => {
    expect(fromRow('trip_stops', { id: 's', trip_id: 't', profile_id: 'p', catalog_id: 'c', added_at: at(9) })).toEqual({
      stopId: 's', catalogId: 'c', addedAt: 9,
    });
  });

  it('round-trips a listing exactly', () => {
    const value = { listingId: 'l', ownerUid: 'o', name: 'n', ratingAvg: 4.5, menuImages: ['m'], updatedAt: 3 };
    expect(fromRow('listings', toRow('listings', value))).toEqual(value);
  });
});
