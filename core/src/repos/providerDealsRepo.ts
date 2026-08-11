// Provider deal authoring (T081a, FR-016b). Deals live in the top-level `deals`
// collection (owner-writable). Queried by ownerUid, sorted client-side.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import type { Deal, DealCost, LocalizedText } from '@svtrip/shared';
import { db } from '../firebase';

const dealsCol = () => collection(db, 'deals');

export interface DealInput {
  listingId: string;
  title: string;
  description: string;
  /** Both languages, always written together (FR-024). */
  titleI18n?: LocalizedText;
  descriptionI18n?: LocalizedText;
  cost: DealCost;
  activeFrom: number;
  activeTo: number;
  image?: string;
}

export async function createDeal(ownerUid: string, input: DealInput): Promise<string> {
  const ref = await addDoc(dealsCol(), { ...input, ownerUid });
  return ref.id;
}

export async function updateDeal(dealId: string, patch: Partial<DealInput>): Promise<void> {
  await updateDoc(doc(dealsCol(), dealId), patch);
}

export async function deleteDeal(dealId: string): Promise<void> {
  await deleteDoc(doc(dealsCol(), dealId));
}

/** Live subscription to the caller's own deals, ending-soonest first. */
export function subscribeToMyDeals(
  ownerUid: string,
  cb: (deals: Deal[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(dealsCol(), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      const deals = snap.docs
        .map((d) => ({ ...(d.data() as Deal), dealId: d.id }))
        .sort((a, b) => a.activeTo - b.activeTo);
      cb(deals);
    },
    onError,
  );
}
