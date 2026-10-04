// Deals data access (T062, FR-016/017): fetch published deals and filter to the
// currently-active window (activeFrom ≤ now ≤ activeTo). The catalog is small,
// so a single read + client-side filter avoids a composite index for the MVP.
//
// FEATURE 018 ADDED A JOIN HERE, and this was the one surface of FR-016's four
// with NO visibility filter at all: this function read `deals`, filtered on the
// date window, and never consulted the owning listing. So a suspended place's
// promotion survived by construction — and so did a promotion from a merchant
// who had dropped to Básico and lost Ofertas (US4 scenario 2).
import { collection, getDocs } from 'firebase/firestore';
import type { Deal, Listing } from '@svtrip/shared';
import { offerVisible, travelerVisible } from '@svtrip/shared';
import { db } from '../firebase';

interface DealsAndListings {
  deals: Deal[];
  listings: Map<string, Listing>;
}

/**
 * Promotions whose window is open, with the listings they belong to.
 *
 * The date window and nothing else. Two different surfaces narrow this
 * differently and **collapsing them is a real defect, found by the visual gate
 * rather than by reasoning**: when `fetchProfileDeals` reused the Ofertas
 * filter, a promotion that left Ofertas also vanished from the business's own
 * profile — which US4 scenario 2 explicitly forbids ("they stop appearing in
 * Ofertas but stay visible on their own profile, and are not deleted").
 *
 * `traveler-place-profile` went 1304px to 1232px. The 72px were a promotion.
 */
async function fetchDealsInWindow(): Promise<DealsAndListings> {
  // Both collections, in parallel. `listings` is read anyway by every other
  // traveler surface, so this is not a new cost on a cold cache — and the
  // alternative, a per-deal document read, would be one round trip per
  // promotion on a screen built to show several.
  const [dealsSnap, listingsSnap] = await Promise.all([
    getDocs(collection(db, 'deals')),
    getDocs(collection(db, 'listings')),
  ]);

  const listings = new Map<string, Listing>(
    listingsSnap.docs.map((d) => [d.id, { ...(d.data() as Listing), listingId: d.id }]),
  );

  const now = Date.now();
  const deals = dealsSnap.docs
    .map((d) => ({ ...(d.data() as Deal), dealId: d.id }))
    .filter((deal) => deal.activeFrom <= now && now <= deal.activeTo)
    .sort((a, b) => a.activeTo - b.activeTo); // ending soonest first

  return { deals, listings };
}

/** What belongs on the Ofertas surface. */
export async function fetchActiveDeals(): Promise<Deal[]> {
  const { deals, listings } = await fetchDealsInWindow();
  // `offerVisible` asks three independent questions and fails CLOSED when the
  // owning listing cannot be resolved. A deal whose place the product cannot
  // vouch for does not belong on a surface travelers are invited to act on.
  return deals.filter((deal) =>
    offerVisible(deal, deal.listingId ? listings.get(deal.listingId) : undefined),
  );
}

/**
 * One place's own promotions, for its profile.
 *
 * Asks a DIFFERENT question than Ofertas does, and the difference is US4
 * scenario 2: a Premium merchant who drops to Básico loses Ofertas and KEEPS
 * these. So `offersEligible` and the merchant's `inOfertas` choice are
 * deliberately NOT consulted here — only whether the place itself is visible.
 *
 * Still fails closed on an unresolvable listing, for the same reason as above.
 */
export async function fetchDealsForPlace(targetId: string): Promise<Deal[]> {
  const { deals, listings } = await fetchDealsInWindow();
  const listing = listings.get(targetId);
  if (!listing) return [];
  if (!travelerVisible(listing)) return [];
  return deals.filter((deal) => deal.listingId === targetId);
}
