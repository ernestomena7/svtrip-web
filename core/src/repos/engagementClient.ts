// Shared engagement client (T085, FR-026). One place to emit traveler
// interactions attributed to a provider listing. Best-effort analytics: the
// call is fire-and-forget and swallows errors so it never blocks or breaks the
// traveler UX (non-listing refIds resolve to 404 server-side and are ignored).
import type { EngagementType } from '@svtrip/shared';
import { recordEngagement as postEngagement } from '../apiClient';

export function recordEngagement(listingId: string, type: EngagementType): void {
  void postEngagement({ listingId, type }).catch(() => {});
}
