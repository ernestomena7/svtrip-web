// Traveler profile data (feature 011).
//
// Registration used to collect an email and a password and nothing else, so the
// product knew nothing about who its travelers were. This adds the vocabulary,
// the country reference list, and the TWO validation layers that must never be
// merged — see `missingProfileFields` vs the validators below.
//
// Lives in `shared/` rather than `core/`: it is plain data and plain functions
// with no React and no Firebase SDK, and the BFF may want the same answers.
import type { UserProfile } from './types.js';

/** Exactly the two options the product owner specified. */
export const GENDERS = ['masculine', 'feminine'] as const;
export type Gender = (typeof GENDERS)[number];

/** Optional everywhere; absence is a normal, valid state. */
export const MARITAL_STATUSES = ['single', 'married'] as const;
export type MaritalStatus = (typeof MARITAL_STATUSES)[number];

/**
 * Stamped on profiles created or completed from this feature onward.
 *
 * Its **absence** marks an account that predates feature 011 — which is what
 * makes grandfathering possible at all. A profile with no gender is ambiguous on
 * its own: it could be an old account that was never asked, or a new one that
 * skipped the step. Only a stamp tells them apart, and inferring from
 * `createdAt` would need a hardcoded deploy timestamp and would misclassify
 * anyone created while it was rolling out.
 *
 * Same idiom `contentVersion` already uses for the publication floor.
 */
export const PROFILE_VERSION = 11;

/** True for an account created before this feature: never gated, only invited. */
export function predatesProfileFields(profile: Pick<UserProfile, 'profileVersion'>): boolean {
  return profile.profileVersion === undefined;
}

/** Age bounds. 120 is above the verified maximum human lifespan, so it rejects
 *  typos without rejecting anyone real. 13 is a product default for
 *  self-registration — NOT a compliance position; if this product ever needs one
 *  legally, that is a separate decision with different inputs. */
export const MIN_AGE = 13;
export const MAX_AGE = 120;

/**
 * Where a traveler is, until they say otherwise.
 *
 * NOT `DEFAULT_COUNTRY_CODE` — `contact.ts` already owns that name for the phone
 * dialling prefix (`+503`). Two different things called the same code would be a
 * genuinely confusing pair to have in one package.
 */
export const DEFAULT_RESIDENCE_COUNTRY = 'SV';

/**
 * ISO 3166-1 alpha-2, officially assigned. Codes only — never names.
 *
 * The localized name comes from the platform's own `Intl.DisplayNames` at render
 * time (see `core/src/countries.ts`). Shipping 249 names × 2 languages in the
 * locale files would mean ~500 keys for a human to keep in sync, would go stale
 * as countries are renamed, and would freeze a traveler's country in whichever
 * language they happened to register in.
 */
export const COUNTRY_CODES: readonly string[] = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
  'HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM',
  'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW',
];

/** The fields a complete profile must carry. Marital status is deliberately absent. */
export type RequiredProfileField = 'firstName' | 'lastName' | 'gender' | 'age' | 'countryCode';

/** Just the parts of a profile these rules look at. */
export type ProfileFields = Partial<
  Pick<UserProfile, 'firstName' | 'lastName' | 'gender' | 'age' | 'countryCode' | 'maritalStatus'>
>;

/**
 * What a profile has never been given — LAYER ONE.
 *
 * Returns the complete list rather than the first gap, for the same reason
 * `missingRequirements()` does: revealing one item at a time turns finishing a
 * profile into a guessing game. Three callers depend on the whole list — the
 * first-run gate, the invitation that names what is missing (FR-019), and the
 * shrinking list after a partial save (FR-020).
 *
 * This is the ONLY function the grandfathering exemption flows through. It says
 * nothing about whether a value that IS present is acceptable — see
 * `validateProfileFields`, and the note there about why they stay apart.
 */
export function missingProfileFields(profile: ProfileFields): RequiredProfileField[] {
  const missing: RequiredProfileField[] = [];
  if (!profile.firstName?.trim()) missing.push('firstName');
  if (!profile.lastName?.trim()) missing.push('lastName');
  if (!profile.gender) missing.push('gender');
  if (profile.age === undefined || profile.age === null) missing.push('age');
  if (!profile.countryCode) missing.push('countryCode');
  return missing;
}

/** Whether every required field has been provided. */
export function isProfileComplete(profile: ProfileFields): boolean {
  return missingProfileFields(profile).length === 0;
}

export type ProfileFieldError = RequiredProfileField | 'maritalStatus';

/**
 * Whether the values PRESENT are acceptable — LAYER TWO.
 *
 * Deliberately separate from `missingProfileFields`, and this is the single most
 * important line in the file: an account that predates this feature is exempt
 * from having to PROVIDE these fields, never from VALIDATION of one it is
 * providing now. Merge the two — "old accounts skip the rules" — and an old
 * account can save an age of "treinta" or 200.
 *
 * The product already draws this line: the publication floor guards regression
 * only, letting an entry already below the bar stay editable so its manager can
 * fix what is missing, while still refusing to make it worse.
 *
 * Absent values are NOT reported here. Absence is layer one's question.
 */
export function validateProfileFields(profile: ProfileFields): ProfileFieldError[] {
  const invalid: ProfileFieldError[] = [];

  if (profile.firstName !== undefined && !profile.firstName.trim()) invalid.push('firstName');
  if (profile.lastName !== undefined && !profile.lastName.trim()) invalid.push('lastName');
  if (profile.gender !== undefined && !GENDERS.includes(profile.gender as Gender)) {
    invalid.push('gender');
  }
  if (profile.age !== undefined && profile.age !== null && !isValidAge(profile.age)) {
    invalid.push('age');
  }
  if (profile.countryCode !== undefined && !COUNTRY_CODES.includes(profile.countryCode)) {
    invalid.push('countryCode');
  }
  if (
    profile.maritalStatus !== undefined &&
    !MARITAL_STATUSES.includes(profile.maritalStatus as MaritalStatus)
  ) {
    invalid.push('maritalStatus');
  }

  return invalid;
}

/** A whole number within a plausible human range. Rejects 12.5, NaN and "30". */
export function isValidAge(value: unknown): boolean {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_AGE &&
    value <= MAX_AGE
  );
}

/**
 * Parse what a traveler typed into an age field.
 *
 * Returns `undefined` for anything that is not digits, so "treinta", "3o" and
 * "30.5" never reach storage as a number — the field accepts digits only
 * (FR-003), and this is the guard behind that.
 */
export function parseAge(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

/**
 * The name every existing screen and BOTH server services already display.
 *
 * `reviewService.ts` reads `displayName` for the author on public reviews and
 * `claimService.ts` for the requester in the operator's approval queue. Neither
 * changes; both keep reading the field they always read. Deriving it here rather
 * than storing a third, separately editable name is what stops the three from
 * disagreeing — and what stops an already-published review from falling back to
 * the generic "Viajero" the moment someone edits their profile.
 */
export function deriveDisplayName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}
