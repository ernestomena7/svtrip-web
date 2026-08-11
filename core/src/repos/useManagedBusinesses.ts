// Does this account manage any business? (T022, feature 006 — FR-005, SC-010.)
//
// The persona switch used to be offered to every account, including the vast
// majority that manage nothing — a traveler could flip into "Negocio" and land
// on an empty dashboard for a business they do not have. The switch now depends
// on this hook.
//
// Deliberately a live subscription, not a one-shot read: the moment an operator
// approves a handover, the new manager's switch must appear without them
// signing out and back in.
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import type { Listing } from '@svtrip/shared';
import { db } from '../firebase';
import { useAuth } from '../auth/AuthProvider';

export interface ManagedBusinesses {
  /** `null` while unknown — callers must not render a switch during this window. */
  listings: Listing[] | null;
  managesAny: boolean;
}

export function useManagedBusinesses(): ManagedBusinesses {
  const { user } = useAuth();
  const [listings, setListings] = useState<Listing[] | null>(null);

  useEffect(() => {
    if (!user) {
      setListings([]);
      return;
    }
    const q = query(collection(db, 'listings'), where('ownerUid', '==', user.uid));
    return onSnapshot(
      q,
      (snap) => {
        setListings(snap.docs.map((d) => ({ ...(d.data() as Listing), listingId: d.id })));
      },
      // A failed read is not evidence of managing something. Showing the switch
      // on error would hand a traveler a provider surface they cannot use.
      () => setListings([]),
    );
  }, [user]);

  return { listings, managesAny: (listings?.length ?? 0) > 0 };
}
