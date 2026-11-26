// Feature 025 (T017, research R5): a listing the app creates starts INVISIBLE (`covered = false`) and
// becomes visible only through the subscription's coverage sync.
//
// The defect this closes, measured before 025: `covered` NULL means visible, and creating a listing
// never recalculated coverage — so a merchant with no plan who created a place in the app got a place
// travelers could see, for free. After the promotion window closes, that would make "not visible until
// you pay" (FR-008) a sentence the product does not keep.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));
vi.mock('../src/repos/discoverRepo', () => ({ clearDiscoverCache: () => {} }));
const postJson = vi.fn(async () => ({ coveredPlaceIds: [] }));
vi.mock('../src/apiClient', () => ({ postJson }));

const { createListing } = await import('../src/repos/listingsRepo');

const INPUT = {
  name: 'Café La Ceiba',
  description: 'Pupusas',
  photos: ['https://x/p.jpg'],
  lat: 13.67,
  lng: -89.28,
  moods: ['comida-local'],
  categories: [],
  active: true,
} as unknown as Parameters<typeof createListing>[1];

beforeEach(() => {
  fake.reset();
  postJson.mockClear();
});

describe('createListing (R5)', () => {
  it('inserts the listing with covered = false', async () => {
    await createListing('merchant-uid', INPUT);
    const insert = fake.writesTo('listings').find((w) => w.op === 'insert');
    expect(insert).toBeDefined();
    expect((insert!.values as Record<string, unknown>).covered).toBe(false);
  });

  it('then asks the server to recalculate coverage', async () => {
    await createListing('merchant-uid', INPUT);
    expect(postJson).toHaveBeenCalledWith('/subscriptions/sync', {});
  });

  it('a failed sync does not fail the creation — the place simply stays invisible until the next sync', async () => {
    postJson.mockRejectedValueOnce(new Error('offline'));
    await expect(createListing('merchant-uid', INPUT)).resolves.toEqual(expect.any(String));
  });
});
