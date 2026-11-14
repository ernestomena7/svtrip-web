// Provider listing CRUD (T074, FR-022/023). Listings live in the top-level
// `listings` collection (owner-writable per security rules). We query by
// ownerUid only and sort client-side so no composite index is required for MVP.
import type { BusinessType, Listing, LocalizedText, OpeningHour } from '@svtrip/shared';
import { CONTENT_VERSION, hasUsableHours } from '@svtrip/shared';
import { supabase } from '../supabase';
import { rowsOf, subscribeLive, userTopic } from '../db/live';
import { fromRow, toRow } from '@svtrip/shared';
import { clearDiscoverCache } from './discoverRepo';


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
  const { data, error } = await supabase
    .from('listings')
    .insert(toRow('listings', { ...input, ownerUid, rating: 0, contentVersion: CONTENT_VERSION, createdAt: now, updatedAt: now }))
    .select('id')
    .single();
  if (error) throw error;
  clearDiscoverCache();
  return data.id as string;
}

export async function updateListing(
  listingId: string,
  patch: Partial<ListingInput>,
): Promise<void> {
  // FR-002a (feature 020): a merchant who empties their opening hours keeps the
  // save and loses the switch.
  //
  // **This lives HERE and not in the BFF, and the first version got that
  // wrong.** `reservationService.saveOpeningHours()` was written to do it, and
  // nothing ever called it: the listing form writes hours straight to Firestore
  // through this function, which the rules allow because the merchant owns the
  // document. A requirement implemented in a layer nothing reaches is a
  // requirement that is not implemented.
  //
  // ONE write, not two. The hours and the flag go together or a crash between
  // them leaves exactly the state this prevents — a place advertising
  // reservations against hours that no longer exist. The two alternatives were
  // both worse and are argued in contracts/reservations-api.md: refusing the
  // save leaves a merchant unable to edit their own hours and surfaces a bare
  // `permission-denied` (feature 010's defect), and leaving the flag on leaves a
  // control reading ON while every request is refused (FR-034's problem in
  // different clothes).
  const clearsReservations =
    patch.openingHours !== undefined && !hasUsableHours(patch.openingHours);

  const { error } = await supabase
    .from('listings')
    .update(
      toRow('listings', {
        ...patch,
        ...(clearsReservations ? { reservationsEnabled: false } : {}),
        contentVersion: CONTENT_VERSION,
        updatedAt: Date.now(),
      }),
    )
    .eq('id', listingId);
  if (error) throw error;
  clearDiscoverCache();
}

export async function deleteListing(listingId: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', listingId);
  if (error) throw error;
  clearDiscoverCache();
}

/** Live subscription to the caller's own listings, newest first. */
export function subscribeToMyListings(
  ownerUid: string,
  cb: (listings: Listing[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return subscribeLive(
    {
      table: 'listings',
      topic: userTopic(ownerUid),
      cacheKey: `myListings:${ownerUid}`,
      read: async () =>
        rowsOf(await supabase.from('listings').select('*').eq('owner_uid', ownerUid))
          .map((r) => fromRow<Listing>('listings', r))
          .sort((a, b) => b.updatedAt - a.updatedAt),
    },
    cb,
    onError as (e: unknown) => void,
  );
}
