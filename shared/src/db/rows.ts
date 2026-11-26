// Row ⇄ app-value converters, in one file (feature 023) — in shared/ because BOTH the client repos
// (core/) and the BFF (server/) convert the same rows, and two copies are how 013 and 014 each lost a
// field (the two listingToPlace mappers).
//
// This is where "three edits per field" lives: features 013 (`createdAt`) and 014 (`priceBand`)
// each lost a field because a mapper copied field by field and one copy forgot it. Keeping every
// converter here, beside its inverse, is what lets a reviewer see a missing field in one place.
// The shapes on the app side are exactly the ones in shared/src/types.ts — screens do not change.
import type { UserProfile } from '../types.js';
import { iso, ms } from './time.js';

type Row = Record<string, unknown>;
const opt = <T>(v: unknown): T | undefined => (v === null || v === undefined ? undefined : (v as T));

// ── The generic converter ───────────────────────────────────────────────────────────────────────
//
// A column maps to the camelCase field of the same name; the few names that do not follow that rule
// are listed. Hand-writing one converter per table is how 013 and 014 each lost a field, so instead
// each table states only what is NOT derivable: which field holds its id, which columns are instants
// (timestamptz ⇄ epoch ms), and which columns are structure rather than app data (a parent key the
// Firestore document carried in its PATH, not its body). supabase/tests/schemaParity.test.ts
// guarantees every type field has a column, so nothing here can be silently skipped.

const FIELD_FOR: Record<string, string> = {
  banner_url: 'bannerURL',
  photo_url: 'photoURL',
  author_photo_url: 'authorPhotoURL',
};
const COLUMN_FOR = Object.fromEntries(Object.entries(FIELD_FOR).map(([c, f]) => [f, c]));
const camel = (c: string) => FIELD_FOR[c] ?? c.replace(/_([a-z0-9])/g, (_, x: string) => x.toUpperCase());
const snake = (f: string) => COLUMN_FOR[f] ?? f.replace(/[A-Z]/g, (x) => `_${x.toLowerCase()}`);

interface TableSpec {
  /** App field that holds the row's `id` (or `key`/`code`) column. */
  idField?: string;
  idColumn?: string;
  /** timestamptz columns — converted to/from epoch ms. */
  times: string[];
  /** Columns that are structure (parent keys), left out of the app value. */
  structural?: string[];
}

export const TABLES: Record<string, TableSpec> = {
  listings: { idField: 'listingId', times: ['created_at', 'updated_at', 'taken_down_at'] },
  business_registrations: { idField: 'registrationId', times: ['enrolled_at', 'free_until', 'welcome_sent_at'] },
  places: { idField: 'placeId', times: [] },
  events: { idField: 'eventId', times: ['start_at', 'end_at'] },
  deals: { idField: 'dealId', times: ['active_from', 'active_to', 'updated_at'] },
  reviews: { idField: 'reviewId', times: ['created_at', 'updated_at'] },
  business_claims: { idField: 'claimId', times: ['created_at', 'updated_at'] },
  reservations: { idField: 'reservationId', times: ['created_at', 'updated_at', 'decided_at'] },
  trips: { idField: 'tripId', times: ['created_at', 'updated_at'], structural: ['profile_id'] },
  trip_stops: { idField: 'stopId', times: ['added_at'], structural: ['profile_id', 'trip_id'] },
  conversations: { idField: 'conversationId', times: ['created_at', 'updated_at'], structural: ['profile_id'] },
  messages: { idField: 'messageId', times: ['created_at'], structural: ['profile_id', 'conversation_id'] },
  shown: { times: ['shown_at', 'taken_up_at'], structural: ['profile_id'] },
  favorites: { times: ['created_at'], structural: ['profile_id'] },
  metrics_daily: { times: [], structural: ['provider_uid', 'day'] },
  business_types: { idField: 'key', idColumn: 'key', times: ['created_at', 'last_changed_at'] },
  moods: { idField: 'key', idColumn: 'key', times: ['created_at', 'last_changed_at'] },
  additional_services: { idField: 'key', idColumn: 'key', times: ['created_at', 'last_changed_at'] },
  subscription_plans: { idField: 'code', idColumn: 'code', times: ['updated_at'] },
  launch_campaign: { times: ['launch_at', 'updated_at'] },
  // Server-side tables (the BFF reads and writes these; no client may).
  provider_profiles: { times: [], structural: [] },
  engagement_events: { times: ['created_at'], structural: ['provider_uid'] },
  review_reports: { times: ['created_at'] },
};

/** A row as the app value Firestore used to hand back: null → absent, instants → epoch ms. */
export function fromRow<T>(table: keyof typeof TABLES, row: Row): T {
  const spec = TABLES[table];
  const idColumn = spec.idColumn ?? 'id';
  const out: Row = {};
  for (const [col, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue;
    if (spec.structural?.includes(col)) continue;
    if (col === idColumn && spec.idField) {
      out[spec.idField] = v;
      continue;
    }
    if (col === 'id') continue;
    out[camel(col)] = spec.times.includes(col) ? ms(v as string) : v;
  }
  return out as T;
}

/**
 * An app value (or a partial patch) as columns. `undefined` is OMITTED, never written as null — a
 * partial save must not clear what it did not mention (feature 011, FR-020). Explicit `null` is kept:
 * that is a deliberate clear.
 */
export function toRow(table: keyof typeof TABLES, value: Record<string, unknown>): Row {
  const spec = TABLES[table];
  const out: Row = {};
  for (const [field, v] of Object.entries(value)) {
    if (v === undefined) continue;
    if (spec.idField && field === spec.idField) {
      out[spec.idColumn ?? 'id'] = v;
      continue;
    }
    const col = snake(field);
    out[col] = spec.times.includes(col) && typeof v === 'number' ? iso(v) : v;
  }
  return out;
}

// ── profiles ────────────────────────────────────────────────────────────────────────────────────

export function profileFromRow(r: Row): UserProfile {
  return {
    uid: r.id as string,
    displayName: r.display_name as string,
    email: r.email as string,
    photoURL: opt(r.photo_url),
    persona: r.persona as UserProfile['persona'],
    onboardingComplete: r.onboarding_complete as boolean,
    preferences: r.preferences as UserProfile['preferences'],
    firstName: opt(r.first_name),
    lastName: opt(r.last_name),
    gender: opt(r.gender),
    age: opt(r.age),
    countryCode: opt(r.country_code),
    maritalStatus: opt(r.marital_status),
    phone: opt(r.phone),
    profileVersion: opt(r.profile_version),
    termsVersion: opt(r.terms_version),
    privacyVersion: opt(r.privacy_version),
    termsAcceptedAt: ms(r.terms_accepted_at as string),
    createdAt: ms(r.created_at as string) ?? 0,
    updatedAt: ms(r.updated_at as string) ?? 0,
  };
}

/** App field names → columns, for PARTIAL writes. Only the keys present are written. */
const PROFILE_COLUMNS: Record<string, string> = {
  displayName: 'display_name', email: 'email', photoURL: 'photo_url', persona: 'persona',
  onboardingComplete: 'onboarding_complete', preferences: 'preferences', firstName: 'first_name',
  lastName: 'last_name', gender: 'gender', age: 'age', countryCode: 'country_code',
  maritalStatus: 'marital_status', phone: 'phone', profileVersion: 'profile_version',
  // Feature 025. `termsAcceptedAt` is deliberately ABSENT: the database trigger sets it, and a client
  // write of it alone is refused — so a patch naming it throws here, before it ever reaches the server.
  termsVersion: 'terms_version', privacyVersion: 'privacy_version',
};

export function profilePatch(patch: Partial<UserProfile> & { updatedAt?: number }): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'updatedAt') out.updated_at = iso(v as number);
    else if (PROFILE_COLUMNS[k]) out[PROFILE_COLUMNS[k]] = v;
    else throw new Error(`profilePatch: no column for "${k}"`); // never drop a field silently
  }
  return out;
}
