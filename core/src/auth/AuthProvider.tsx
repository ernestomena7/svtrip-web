// Auth + profile context. Bridges Firebase auth state, the Firestore profile,
// and the global UI store (language/persona sync across devices).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { UserProfile } from '@svtrip/shared';
import { auth } from '../firebase';
import { ensureUserProfile, subscribeToProfile } from './userProfile';
import { useUiStore } from '../uiStore';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, profile: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const hydrateFrom = useUiStore((s) => s.hydrateFrom);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          await ensureUserProfile(u);
        } catch (err) {
          // Never let a profile-write failure hang the app on the loading
          // spinner forever; surface via the profile listener staying null.
          console.error('ensureUserProfile failed:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, (p) => {
      setProfile(p);
      if (p?.preferences) {
        hydrateFrom({
          language: p.preferences.language,
          persona: p.persona,
        });
      }
    });
  }, [user, hydrateFrom]);

  return <AuthContext.Provider value={{ user, profile, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
