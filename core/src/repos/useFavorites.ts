// Favorites (US-favorites): live set of the traveler's saved ids, plus a toggle. Feature 023: the
// `favorites` table (owner-only policy) in place of `users/{uid}/favorites`; same hook, same shape.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { recordEngagement } from './engagementClient';
import { useAuth } from '../auth/AuthProvider';
import { rowsOf, subscribeLive, userTopic } from '../db/live';
import { nowIso } from '@svtrip/shared';

type FavoriteKind = 'place' | 'event' | 'listing';

export function useFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    return subscribeLive(
      {
        table: 'favorites',
        topic: userTopic(user.uid),
        cacheKey: `favorites:${user.uid}`,
        read: async () => rowsOf(await supabase.from('favorites').select('place_id').eq('profile_id', user.uid)).map((r) => r.place_id as string),
      },
      (list) => setIds(new Set(list)),
    );
  }, [user]);

  const toggle = useCallback(
    async (id: string, kind: FavoriteKind) => {
      if (!user) return;
      if (ids.has(id)) {
        const { error } = await supabase.from('favorites').delete().eq('profile_id', user.uid).eq('place_id', id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('favorites')
        .upsert({ profile_id: user.uid, place_id: id, type: kind, created_at: nowIso() }, { onConflict: 'profile_id,place_id' });
      if (error) throw error;
      // Engagement is attributed to provider listings only — the curated catalog has no owner.
      if (kind === 'listing') {
        recordEngagement(id, 'favorite_click');
      }
    },
    [user, ids],
  );

  return { favoriteIds: ids, isFavorite: (id: string) => ids.has(id), toggle };
}
