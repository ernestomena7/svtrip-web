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
import type { Listing } from '@svtrip/shared';
import { supabase } from '../supabase';
import { useAuth } from '../auth/AuthProvider';
import { rowsOf, subscribeLive, userTopic } from '../db/live';
import { fromRow } from '@svtrip/shared';

export interface ManagedBusinesses {
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
    return subscribeLive(
      {
        table: 'listings',
        topic: userTopic(user.uid),
        cacheKey: `managed:${user.uid}`,
        read: async () =>
          rowsOf(await supabase.from('listings').select('*').eq('owner_uid', user.uid)).map((r) => fromRow<Listing>('listings', r)),
      },
      setListings,
      () => setListings([]),
    );
  }, [user]);

  return { listings, managesAny: (listings?.length ?? 0) > 0 };
}
