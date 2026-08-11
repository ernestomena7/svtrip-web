// Favorites toggle (T059): writes `users/{uid}/favorites/{id}` and, for
// provider-owned listings, emits a `favorite_click` engagement event so it is
// attributed to the owning provider's Dashboard metrics (FR-026).
import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { recordEngagement } from './engagementClient';
import { useAuth } from '../auth/AuthProvider';

type FavoriteKind = 'place' | 'event' | 'listing';

export function useFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    return onSnapshot(collection(db, 'users', user.uid, 'favorites'), (snap) => {
      setIds(new Set(snap.docs.map((d) => d.id)));
    });
  }, [user]);

  const toggle = useCallback(
    async (id: string, kind: FavoriteKind) => {
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'favorites', id);
      if (ids.has(id)) {
        await deleteDoc(ref);
        return;
      }
      await setDoc(ref, { placeId: id, type: kind, createdAt: serverTimestamp() });
      if (kind === 'listing') {
        recordEngagement(id, 'favorite_click');
      }
    },
    [user, ids],
  );

  return { favoriteIds: ids, isFavorite: (id: string) => ids.has(id), toggle };
}
