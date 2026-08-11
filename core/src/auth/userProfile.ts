// UserProfile create/load + preference persistence in Firestore (US1, FR-002).
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import type { PreferenceSet, UserProfile } from '@svtrip/shared';
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
  await setDoc(ref, { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
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

export async function setPersona(uid: string, persona: 'traveler' | 'provider'): Promise<void> {
  await setDoc(profileRef(uid), { persona, updatedAt: serverTimestamp() }, { merge: true });
}
