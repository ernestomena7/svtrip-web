// The link origin of a merchant sign-up (feature 025, research R7).
//
// It comes from `utm_source` / `src` in a URL anyone can type, and it is stored in a count table and on
// each registration. So it is reduced to a short slug or one of two fixed words — never free text,
// which would turn a count table into a place to store arbitrary strings. The database checks the same
// pattern (`business_signup_daily.origin`, `business_registrations.origin`).

/** The pattern the database enforces. */
export const ORIGIN_PATTERN = /^[a-z0-9_-]{1,32}$/;

export function normaliseOrigin(raw: unknown): string {
  if (raw === undefined || raw === null) return 'direct';
  if (typeof raw !== 'string') return 'other';
  const trimmed = raw.trim();
  if (trimmed === '') return 'direct';
  const slug = trimmed.toLowerCase();
  return ORIGIN_PATTERN.test(slug) ? slug : 'other';
}
