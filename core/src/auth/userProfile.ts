// UserProfile create/load + preference persistence in Firestore (US1, FR-002).
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { PreferenceSet, UserProfile } from '@svtrip/shared';
import { PROFILE_VERSION, deriveDisplayName } from '@svtrip/shared';
import { db } from '../firebase';

function profileRef(uid: string) {
  return doc(db, 'users', uid);
}

export function defaultPreferences(): PreferenceSet {
  // SVTrip is Spanish-primary; the app has a single on-brand light theme.
  return { language: 'es', vibes: [] };
}

/** Ensure a profile document exists for a freshly signed-in user. */
export async function ensureUserProfile(user: User): Promise<void> {
  const ref = profileRef(user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const profile: Omit<UserProfile, 'createdAt' | 'updatedAt' | 'photoURL'> = {
    uid: user.uid,
    // Password accounts carry no display name, so this default is now actually
    // user-visible on the Profile screen. The brand voice is Spanish-first, and
    // an English literal here was off-brand (Constitution VI).
    displayName: user.displayName?.trim() || 'Viajero',
    email: user.email ?? '',
    persona: 'traveler',
    onboardingComplete: false,
    preferences: defaultPreferences(),
  };
  // Firestore rejects `undefined` field values, so omit photoURL entirely
  // rather than writing user.photoURL ?? undefined (accounts without a
  // profile photo would otherwise fail to sign in).
  const data = user.photoURL ? { ...profile, photoURL: user.photoURL } : profile;
  await setDoc(ref, {
    ...data,
    // Stamped here, on the ONE path that creates a profile document, so every
    // account born from feature 011 onward carries it. An older account never
    // reaches this line — its document already exists — which is exactly what
    // leaves it unstamped and therefore grandfathered (FR-018). Inferring the
    // same thing from `createdAt` would need a hardcoded deploy timestamp and
    // would misclassify anyone who signed up while it was rolling out.
    profileVersion: PROFILE_VERSION,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Real-time subscription to the profile for cross-device sync (T035). */
export function subscribeToProfile(
  uid: string,
  cb: (profile: UserProfile | null) => void,
): () => void {
  return onSnapshot(profileRef(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as UserProfile) : null);
  });
}

export async function updatePreferences(
  uid: string,
  prefs: Partial<PreferenceSet>,
): Promise<void> {
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  const current = (snap.data()?.preferences as PreferenceSet | undefined) ?? defaultPreferences();
  await setDoc(
    ref,
    { preferences: { ...current, ...prefs }, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function completeOnboarding(uid: string, vibes: string[]): Promise<void> {
  await updatePreferences(uid, { vibes });
  await setDoc(profileRef(uid), { onboardingComplete: true, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Save the traveler's own details (feature 011).
 *
 * Writes `displayName` on EVERY call that carries both names, derived rather
 * than stored separately. That is not tidiness — `reviewService.ts` reads
 * `displayName` for the author on public reviews and `claimService.ts` for the
 * requester in the operator's approval queue, both server-side, and neither
 * changes in this feature. Leaving it unwritten would fall those screens back to
 * their generic placeholder ("Viajero", "Usuario") on reviews that are already
 * published — a regression invisible from the screen where the edit is made.
 *
 * `profileVersion` is stamped on every save, which is also how an account that
 * predated this feature stops being grandfathered once it has been completed.
 *
 * Partial saves are supported on purpose (FR-020): a traveler whose account is
 * missing four fields can fill two, save, and come back — so `undefined` fields
 * are omitted rather than written as null.
 */
export async function saveProfileFields(
  uid: string,
  fields: Partial<
    Pick<UserProfile, 'firstName' | 'lastName' | 'gender' | 'age' | 'countryCode' | 'maritalStatus'>
  >,
): Promise<void> {
  const ref = profileRef(uid);
  const snap = await getDoc(ref);
  const current = (snap.data() ?? {}) as Partial<UserProfile>;

  // Firestore rejects `undefined`, and an untouched field must stay untouched.
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) patch[key] = value;
  }

  // Derived from whatever the profile will hold AFTER this write, so a save that
  // changes only the surname still produces the right full name.
  const firstName = (patch.firstName as string | undefined) ?? current.firstName ?? '';
  const lastName = (patch.lastName as string | undefined) ?? current.lastName ?? '';
  const displayName = deriveDisplayName(firstName, lastName);
  // Only when there is something to derive from: a partial save that has not yet
  // reached the names must not blank out whatever the account already displays.
  if (displayName) patch.displayName = displayName;

  await setDoc(
    ref,
    { ...patch, profileVersion: PROFILE_VERSION, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function setPersona(uid: string, persona: 'traveler' | 'provider'): Promise<void> {
  await setDoc(profileRef(uid), { persona, updatedAt: serverTimestamp() }, { merge: true });
}
