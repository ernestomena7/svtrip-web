// Auth + profile context. Bridges the Supabase session, the profile row, and the global UI store
// (language/persona sync across devices). `user` keeps the shape screens read (`AppUser`), so none
// of them change (feature 023).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserProfile } from '@svtrip/shared';
import { setCurrentSession, supabase, type AppUser } from '../supabase';
import { ensureUserProfile, subscribeToProfile } from './userProfile';
import { isRecoveringPassword } from './authService';
import { syncPushOnSignIn } from '../push/pushRegistration';
import { useUiStore } from '../uiStore';

interface AuthContextValue {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const hydrateFrom = useUiStore((s) => s.hydrateFrom);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // A password-reset link opens a recovery session. It is not a sign-in: exposing it would swap
      // the router to the signed-in tree, which redirects /reset-password to the index, and the
      // traveler would never reach the new-password form.
      const u = isRecoveringPassword() ? setCurrentSession(null) : setCurrentSession(session);
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // DEFERRED, never awaited here: a Supabase call made INSIDE this callback can deadlock the
      // client (documented supabase-js behaviour). The profile write runs on the next tick.
      setTimeout(() => {
        ensureUserProfile(u)
          .catch((err) => {
            // Never let a profile-write failure hang the app on the spinner; the profile listener
            // simply stays null.
            console.error('ensureUserProfile failed:', err);
          })
          .finally(() => setLoading(false));
        // Refresh this phone's push token for the account — only if notifications are already
        // allowed; it never asks (feature 020 US4, FR-031). Never awaited, never fatal.
        void syncPushOnSignIn(u.uid);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, (p) => {
      setProfile(p);
      if (p?.preferences) {
        hydrateFrom({ language: p.preferences.language, persona: p.persona });
      }
    });
  }, [user, hydrateFrom]);

  return <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
