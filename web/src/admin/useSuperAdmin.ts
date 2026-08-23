// Is the signed-in account a super admin? (feature 010 — FR-002.)
//
// Reads the custom claim off the ID token. This gates the admin UI's VISIBILITY
// only — it is not the security boundary and must never be mistaken for one.
// The real check is `requireSuperAdmin` on the BFF, which re-reads the user
// record server-side on every write. Someone who forces this hook to return true
// gets a screen whose every button returns 403.
//
// `getIdTokenResult(true)` is not used: forcing a refresh on every mount costs a
// network round trip on a screen most visitors never open. A freshly granted
// claim therefore needs a sign-out/in, which the granting script says out loud.
import { useEffect, useState } from 'react';
import { useAuth } from '@svtrip/core/auth/AuthProvider';

/** Must match `SUPER_ADMIN_CLAIM` in server/src/middleware/superAdmin.ts. */
export const SUPER_ADMIN_CLAIM = 'svtripSuperAdmin';

export function useSuperAdmin(): { isSuperAdmin: boolean; checking: boolean } {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsSuperAdmin(false);
      setChecking(false);
      return;
    }
    setChecking(true);
    user
      .getIdTokenResult()
      .then((res) => {
        if (cancelled) return;
        setIsSuperAdmin(res.claims?.[SUPER_ADMIN_CLAIM] === true);
        setChecking(false);
      })
      .catch(() => {
        // A failed token read means "not a super admin", never "assume yes".
        if (cancelled) return;
        setIsSuperAdmin(false);
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isSuperAdmin, checking };
}
