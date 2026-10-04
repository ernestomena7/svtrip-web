// Shared engagement client (T085, FR-026). One place to emit traveler
// interactions attributed to a provider listing. Best-effort analytics: the
// call is fire-and-forget and swallows errors so it never blocks or breaks the
// traveler UX (non-listing refIds resolve to 404 server-side and are ignored).
import type { EngagementOrigin, EngagementType } from '@svtrip/shared';
import { recordEngagement as postEngagement } from '../apiClient';

/**
 * Where a traveler came from, when nothing says otherwise (feature 018).
 *
 * `direct` rather than a guess. The honest default matters because
 * `PlaceProfileScreen` is reached from Discover, from search, from a guide
 * plan, from Ofertas, from the landing and from a pasted link — and by the time
 * it mounts, that is gone unless the navigation carried it (research R6).
 */
export const DEFAULT_ORIGIN: EngagementOrigin = 'direct';

export interface EngagementContext {
  /** The SURFACE, never the person (FR-039). */
  origin?: EngagementOrigin;
  /** Only meaningful on the two promotion events. */
  dealId?: string;
}

export function recordEngagement(
  listingId: string,
  type: EngagementType,
  ctx: EngagementContext = {},
): void {
  void postEngagement({
    listingId,
    type,
    // Omitted rather than sent as undefined: the field is optional on the wire
    // so an older client sends nothing at all, and the server must not have to
    // tell "absent" from "explicitly undefined".
    ...(ctx.origin ? { origin: ctx.origin } : {}),
    ...(ctx.dealId ? { dealId: ctx.dealId } : {}),
  }).catch(() => {});
}
