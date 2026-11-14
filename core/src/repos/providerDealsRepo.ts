// Provider deal authoring (T081a, FR-016b). Deals live in the `deals` table (owner-writable, the
// owner pinned by policy and guard trigger). Queried by owner, sorted client-side.
import type { Deal, DealCost, LocalizedText } from '@svtrip/shared';
import { supabase } from '../supabase';
import { rowsOf, subscribeLive, userTopic } from '../db/live';
import { fromRow, toRow } from '@svtrip/shared';
import { nowIso } from '@svtrip/shared';

export interface DealInput {
  listingId: string;
  title: string;
  description: string;
  titleI18n?: LocalizedText;
  descriptionI18n?: LocalizedText;
  cost: DealCost;
  activeFrom: number;
  activeTo: number;
  image?: string;
}

export async function createDeal(ownerUid: string, input: DealInput): Promise<string> {
  const { data, error } = await supabase
    .from('deals')
    .insert({ ...toRow('deals', { ...input }), owner_uid: ownerUid, updated_at: nowIso() })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function updateDeal(dealId: string, patch: Partial<DealInput>): Promise<void> {
  const { error } = await supabase.from('deals').update({ ...toRow('deals', patch), updated_at: nowIso() }).eq('id', dealId);
  if (error) throw error;
}

export async function deleteDeal(dealId: string): Promise<void> {
  const { error } = await supabase.from('deals').delete().eq('id', dealId);
  if (error) throw error;
}

export function subscribeToMyDeals(
  ownerUid: string,
  cb: (deals: Deal[]) => void,
  onError?: (e: Error) => void,
): () => void {
  return subscribeLive(
    {
      table: 'deals',
      topic: userTopic(ownerUid),
      cacheKey: `myDeals:${ownerUid}`,
      read: async () =>
        rowsOf(await supabase.from('deals').select('*').eq('owner_uid', ownerUid))
          .map((r) => fromRow<Deal>('deals', r))
          .sort((a, b) => a.activeTo - b.activeTo),
    },
    cb,
    onError as (e: unknown) => void,
  );
}
