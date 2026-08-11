// Provider listing CRUD (T074, FR-022/023). Listings live in the top-level
// `listings` collection (owner-writable per security rules). We query by
// ownerUid only and sort client-side so no composite index is required for MVP.
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
import type { BusinessType, Listing, LocalizedText, OpeningHour } from '@svtrip/shared';
import { CONTENT_VERSION } from '@svtrip/shared';
import { db } from '../firebase';
import { clearDiscoverCache } from './discoverRepo';

const listingsCol = () => collection(db, 'listings');

export interface ListingInput {
  name: string;
  description: string;
  /** Both languages, always written together — never half-populated (FR-015). */
  nameI18n?: LocalizedText;
  descriptionI18n?: LocalizedText;
  photos: string[];
  /** Full international format, or omitted entirely (FR-032). */
  phone?: string;
  whatsapp?: string;
  lat: number;
  lng: number;
  openingHours: OpeningHour[];
  moods: string[];
  active: boolean;
  /**
   * Business profile fields (feature 005). `categories` is deliberately absent:
   * it used to be written as an exact copy of `moods`, carrying no information
   * while being what the AI Guide received as catalog context. `businessType`
   * replaces it as the answer to "what is this" (FR-046).
   */
  businessType?: BusinessType;
  bannerURL?: string;
  gallery?: string[];
  services?: string[];
  menuImages?: string[];
}

/**
 * Create a listing owned by the caller. Returns the new listing id.
 *
 * `contentVersion` is stamped here and on every update. Its absence is what
 * marks an entry as predating feature 006 and exempts it from the publication
 * minimums (FR-009b) — so anything written from now on is held to the full
 * floor, and the 18 photoless catalog entries are not.
 */
export async function createListing(ownerUid: string, input: ListingInput): Promise<string> {
  const now = Date.now();
  const ref = await addDoc(listingsCol(), {
    ...input,
    ownerUid,
    rating: 0,
    contentVersion: CONTENT_VERSION,
    createdAt: now,
    updatedAt: now,
  });
  clearDiscoverCache();
  return ref.id;
}

export async function updateListing(
  listingId: string,
  patch: Partial<ListingInput>,
): Promise<void> {
  await updateDoc(doc(listingsCol(), listingId), {
    ...patch,
    contentVersion: CONTENT_VERSION,
    updatedAt: Date.now(),
  });
  clearDiscoverCache();
}

export async function deleteListing(listingId: string): Promise<void> {
  await deleteDoc(doc(listingsCol(), listingId));
  clearDiscoverCache();
}

/** Live subscription to the caller's own listings, newest first. */
export function subscribeToMyListings(
  ownerUid: string,
  cb: (listings: Listing[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(listingsCol(), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      const listings = snap.docs
        .map((d) => ({ ...(d.data() as Listing), listingId: d.id }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
      cb(listings);
    },
    onError,
  );
}
