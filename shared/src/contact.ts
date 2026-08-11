// Business contact numbers (feature 006, FR-032).
//
// Captured here, used by the "get directions and contact" feature: this is the
// feature that gives a business the ability to edit its own fields, so a number
// entered now is a number that exists when the buttons ship.
//
// Validation is deliberately shallow. A number is either in full international
// format or it is not — anything deeper (carrier lookup, "is this WhatsApp-
// capable") is a promise this codebase cannot keep, and a false negative here
// means a real business cannot save a real number.
/** Leading +, country code, 7–14 more digits. Separators are stripped first. */
const INTERNATIONAL = /^\+[1-9]\d{7,14}$/;

/** El Salvador. Used only as the placeholder hint, never assumed. */
export const DEFAULT_COUNTRY_CODE = '+503';

/** Remove spaces, dashes and parentheses — how people actually type numbers. */
export function normalizePhone(raw: string): string {
  return raw.replace(/[\s().-]/g, '');
}

/**
 * Empty is valid: a business with no phone is a normal business (a national park
 * has none), and the contact buttons simply do not render for it. Treating empty
 * as invalid would block saving the rest of the profile.
 */
export function isValidPhone(raw: string | undefined): boolean {
  const value = normalizePhone(raw ?? '').trim();
  if (!value) return true;
  return INTERNATIONAL.test(value);
}
