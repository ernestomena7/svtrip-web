// Deals data access (T062, FR-016/017): fetch published deals and filter to the
// currently-active window (activeFrom ≤ now ≤ activeTo). The catalog is small,
// so a single read + client-side filter avoids a composite index for the MVP.
import { collection, getDocs } from 'firebase/firestore';
import type { Deal } from '@svtrip/shared';
import { db } from '../firebase';

export async function fetchActiveDeals(): Promise<Deal[]> {
  const snap = await getDocs(collection(db, 'deals'));
  const now = Date.now();
  return snap.docs
    .map((d) => ({ ...(d.data() as Deal), dealId: d.id }))
    .filter((deal) => deal.activeFrom <= now && now <= deal.activeTo)
    .sort((a, b) => a.activeTo - b.activeTo); // ending soonest first
}
