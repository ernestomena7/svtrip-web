/**
 * The app version, as the build injected it (feature 022, FR-012, SC-008).
 *
 * **The fallback is `'dev'` and NEVER a plausible number.** A version that is silently right in the
 * repository and wrong on the device is worse than none: its whole job is answering "which build is
 * this?" when something is wrong, and a confident wrong answer sends someone debugging the wrong
 * build. `'dev'` cannot be mistaken for a release.
 *
 * This week already paid for the same failure with a different variable: an APK built without
 * `VITE_BFF_BASE_URL` shipped pointing at `localhost:8787` and broke every server call on a real
 * phone, and it took Cloud Run's logs to find that the requests never arrived.
 *
 * `shared/` has no DOM and no Vite, so the constant is passed IN by each surface rather than read
 * here. That keeps this module testable and keeps `check:boundaries` green.
 */
export const VERSION_FALLBACK = 'dev';

export function resolveAppVersion(injected: string | undefined | null): string {
  const v = typeof injected === 'string' ? injected.trim() : '';
  return v === '' ? VERSION_FALLBACK : v;
}
