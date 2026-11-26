// The traveler's profile row (public.profiles) — create, subscribe, and the four writers screens use
// (feature 023 port of the Firestore `users/{uid}` document). Every writer keeps its signature and,
// above all, its CONSEQUENCE: which ones stamp `profile_version` and which never do.
import type { PreferenceSet, UserProfile } from '@svtrip/shared';
import { PROFILE_VERSION, deriveDisplayName } from '@svtrip/shared';
import { supabase, toAppUser, type AppUser } from '../supabase';
import { profileFromRow, profilePatch } from '@svtrip/shared';
import { subscribeLive, userTopic } from '../db/live';
import { nowIso } from '@svtrip/shared';

export function defaultPreferences(): PreferenceSet {
  return { language: 'es', vibes: [] };
}

async function readProfile(uid: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return data ? profileFromRow(data) : null;
}

async function patchProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...profilePatch(patch), updated_at: nowIso() })
    .eq('id', uid)
    .select('id');
  if (error) throw error;
  // An UPDATE that matches no row is NOT an error to Postgres — it reports success and changes
  // nothing. Firestore's `set(..., { merge: true })` created a missing document instead, so every
  // caller here was written assuming the write lands. The first time it did not, a new traveler's
  // registration answers vanished and the profile form asked for them again (2026-10-22). Silent
  // no-ops are worse than errors: this one is now loud.
  if (!data?.length) throw Object.assign(new Error('profile_not_found'), { code: 'profile_not_found' });
}

/** Ensure a profile row exists for a freshly signed-in user. */
export async function ensureUserProfile(user: AppUser): Promise<void> {
  if (await readProfile(user.uid)) return;
  const now = nowIso();
  const { error } = await supabase.from('profiles').insert({
    id: user.uid,
    display_name: user.displayName?.trim() || 'Viajero',
    email: user.email ?? '',
    persona: 'traveler',
    onboarding_complete: false,
    preferences: defaultPreferences(),
    ...(user.photoURL ? { photo_url: user.photoURL } : {}),
    // A NEW account is stamped — that is what makes it subject to the profile gate (feature 011).
    profile_version: PROFILE_VERSION,
    created_at: now,
    updated_at: now,
  });
  // Two tabs signing in at once race to create the same row; the loser's duplicate is harmless.
  if (error && error.code !== '23505') throw error;
}

/** Real-time subscription to the profile for cross-device sync (T035). */
export function subscribeToProfile(uid: string, cb: (profile: UserProfile | null) => void): () => void {
  return subscribeLive(
    { table: 'profiles', topic: userTopic(uid), read: () => readProfile(uid), cacheKey: `profile:${uid}` },
    cb,
  );
}

export async function updatePreferences(uid: string, prefs: Partial<PreferenceSet>): Promise<void> {
  const current = (await readProfile(uid))?.preferences ?? defaultPreferences();
  await patchProfile(uid, { preferences: { ...current, ...prefs } });
}

export async function completeOnboarding(uid: string, vibes: string[]): Promise<void> {
  await updatePreferences(uid, { vibes });
  await patchProfile(uid, { onboardingComplete: true });
}

/**
 * Save the traveler's own details (feature 011).
 *
 * Writes `displayName` on EVERY call that carries both names — derived, never independent, because
 * reviewService and claimService read it server-side for published reviews and the claim queue.
 * Stamps `profile_version` on every save: this is how an account that predated feature 011 stops
 * being grandfathered once it has been completed. Partial saves are supported (FR-020): undefined
 * fields are omitted rather than written as null.
 */
/**
 * Record which Terms and Privacy versions the account accepted (feature 025, research R12).
 *
 * Deliberately NOT through `saveProfileFields`: that stamps `profile_version`, and feature 020 measured
 * that doing so to a grandfathered, incomplete account ejects it into the mandatory profile form. The
 * acceptance time is set by a database trigger to the server's clock (U6), so it is not written here.
 */
export async function recordTermsAcceptance(
  uid: string,
  versions: { termsVersion: string; privacyVersion: string },
): Promise<void> {
  await patchProfile(uid, { termsVersion: versions.termsVersion, privacyVersion: versions.privacyVersion });
}

export async function saveProfileFields(
  uid: string,
  fields: Partial<Pick<UserProfile, 'firstName' | 'lastName' | 'gender' | 'age' | 'countryCode' | 'maritalStatus'>>,
): Promise<void> {
  let existing = await readProfile(uid);
  if (!existing) {
    // REGISTRATION saves these fields the instant the account exists — before AuthProvider's
    // deferred `ensureUserProfile` has created the row. Create it here first, from the session's own
    // user (never a caller-supplied one), so the answers have a row to land in. Idempotent: if
    // AuthProvider gets there at the same moment, the duplicate insert is ignored.
    const { data } = await supabase.auth.getSession();
    const me = data.session?.user;
    if (me?.id === uid) {
      await ensureUserProfile(toAppUser(me));
      existing = await readProfile(uid);
    }
  }
  const current = existing ?? ({} as Partial<UserProfile>);
  const patch: Partial<UserProfile> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) (patch as Record<string, unknown>)[key] = value;
  }
  const displayName = deriveDisplayName(patch.firstName ?? current.firstName ?? '', patch.lastName ?? current.lastName ?? '');
  if (displayName) patch.displayName = displayName;
  await patchProfile(uid, { ...patch, profileVersion: PROFILE_VERSION });
}

/**
 * Remember the traveler's phone from the reservation form (feature 020, FR-008).
 *
 * Its own writer, and NEVER through saveProfileFields: that stamps `profile_version`, and the stamp's
 * ABSENCE is what exempts an older account from the mandatory profile form. Measured 2026-10-13:
 * 62 of 71 accounts were unstamped AND incomplete — stamping on a reservation would lock 87% of
 * travelers out. So: the phone and a timestamp, nothing else. core/tests/travelerPhone.test.ts
 * asserts the consequence.
 */
export async function saveTravelerPhone(uid: string, phone: string): Promise<void> {
  await patchProfile(uid, { phone: phone.trim() });
}

export async function setPersona(uid: string, persona: 'traveler' | 'provider'): Promise<void> {
  await patchProfile(uid, { persona });
}
