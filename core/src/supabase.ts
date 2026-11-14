// Supabase client (feature 023) — replaces core/src/firebase.ts.
//
// Only PUBLIC configuration lives here: the project URL and the PUBLISHABLE key, which are public by
// design and whose power is bounded entirely by the database's row-level policies (Constitution
// 4.0.0, Principle I). The secret / service-role key is server-only and `check:brand` fails a build
// that carries one.
//
// MUST NOT THROW AT IMPORT. Feature 020 lost 17 tests that stopped LOADING because `getAuth()` ran at
// import time with no config. `createClient` throws on an EMPTY url or key, so both fall back to
// inert placeholders — a test that never touches the network never notices, and a build missing the
// variables fails visibly at its first request instead of at module load.
import { createClient, type Session, type User } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'http://127.0.0.1:54321';
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'missing-publishable-key';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/**
 * The slice of a signed-in user the app reads — the same names the Firebase `User` exposed, so the
 * ~90 call sites reading `user.uid` and the screens reading `providerData` / `getIdTokenResult()`
 * keep working without change. Measured before writing it (`grep user\.`): uid, email, photoURL,
 * displayName, providerData, getIdToken, getIdTokenResult. Nothing else is used.
 */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerData: { providerId: 'password' | 'google.com' }[];
  getIdToken(): Promise<string>;
  /** `claims` are the account's `app_metadata` — where the elevated roles live (never user_metadata). */
  getIdTokenResult(): Promise<{ claims: Record<string, unknown> }>;
}

export function toAppUser(user: User): AppUser {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const providers = new Set(
    (user.identities ?? []).map((i) => (i.provider === 'google' ? 'google.com' : 'password') as 'google.com' | 'password'),
  );
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
    photoURL: (meta.avatar_url as string | undefined) ?? (meta.picture as string | undefined) ?? null,
    providerData: [...providers].map((providerId) => ({ providerId })),
    async getIdToken() {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? '';
    },
    async getIdTokenResult() {
      const { data } = await supabase.auth.getUser();
      return { claims: (data.user?.app_metadata ?? user.app_metadata ?? {}) as Record<string, unknown> };
    },
  };
}

let current: AppUser | null = null;
export function setCurrentSession(session: Session | null): AppUser | null {
  current = session?.user ? toAppUser(session.user) : null;
  return current;
}

/**
 * `auth.currentUser`, as the two registration screens and the API client read it. Kept under the
 * same name so those call sites change only their import path.
 */
export const auth = {
  get currentUser(): AppUser | null {
    return current;
  },
};
