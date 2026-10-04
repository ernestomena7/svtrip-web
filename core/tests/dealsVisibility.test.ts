// T062 (feature 018): Ofertas filters by the owning listing, which it never did.
//
// `fetchActiveDeals` read `deals`, filtered on the date window, and never
// consulted the owning listing. So a suspended place's promotion survived by
// construction — and so did one from a merchant who had dropped to Básico and
// lost Ofertas (US4 scenario 2). It is the only one of FR-016's four insertion
// points where the work was a JOIN rather than one more conjunct.
//
// The THREE-QUESTION rule is what these cases pin, because collapsing any two
// of them loses something real:
//
//   covered          is the place visible at all
//   offersEligible   may this owner publish to Ofertas       (the plan)
//   inOfertas        did the merchant choose to publish IT   (their choice)
//
// Collapse the last two and a Premium merchant loses the ability to keep a
// promotion profile-only (US2 scenario 3). Collapse the first two and a
// downgrade deletes a promotion instead of unpublishing it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

interface Row {
  id: string;
  data: Record<string, unknown>;
}

let dealRows: Row[] = [];
let listingRows: Row[] = [];

vi.mock('../src/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ name }),
  getDocs: async (ref: { name: string }) => ({
    docs: (ref.name === 'deals' ? dealRows : listingRows).map((r) => ({
      id: r.id,
      data: () => r.data,
    })),
  }),
}));

const { fetchActiveDeals } = await import('../src/repos/dealsRepo');

const DAY = 24 * 60 * 60 * 1000;

/** A listing that clears feature 006's floor, so only the new flags vary. */
function listing(id: string, over: Record<string, unknown> = {}): Row {
  return {
    id,
    data: {
      ownerUid: 'merchant',
      name: 'Cafe',
      description: 'Un cafe.',
      photos: ['p.jpg'],
      businessType: 'restaurant-cafe',
      nameI18n: { es: 'Cafe', en: 'Cafe' },
      descriptionI18n: { es: 'Un cafe.', en: 'A cafe.' },
      contentVersion: 6,
      active: true,
      ...over,
    },
  };
}

/** A promotion whose window is open right now. */
function deal(id: string, listingId: string, over: Record<string, unknown> = {}): Row {
  return {
    id,
    data: {
      ownerUid: 'merchant',
      listingId,
      title: 'Promo',
      description: '2x1',
      cost: { amount: 10, currency: 'USD' },
      activeFrom: Date.now() - DAY,
      activeTo: Date.now() + DAY,
      ...over,
    },
  };
}

beforeEach(() => {
  dealRows = [];
  listingRows = [];
});

async function visibleIds(): Promise<string[]> {
  return (await fetchActiveDeals()).map((d) => d.dealId);
}

describe('the date window still decides, as it always did', () => {
  it('hides a promotion whose window has closed', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: true })];
    dealRows = [deal('expired', 'cafe', { activeTo: Date.now() - DAY })];
    expect(await visibleIds()).toEqual([]);
  });

  it('shows one whose window is open', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: true })];
    dealRows = [deal('live', 'cafe')];
    expect(await visibleIds()).toEqual(['live']);
  });
});

describe('a SUSPENDED place takes its promotion with it', () => {
  it('hides the promotion of an uncovered place', async () => {
    listingRows = [listing('cafe', { covered: false, offersEligible: true })];
    dealRows = [deal('orphan', 'cafe')];
    expect(await visibleIds()).toEqual([]);
  });

  it('leaves other merchants’ promotions alone', async () => {
    listingRows = [
      listing('lapsed', { covered: false, offersEligible: true }),
      listing('paid', { covered: true, offersEligible: true }),
    ];
    dealRows = [deal('gone', 'lapsed'), deal('stays', 'paid')];
    expect(await visibleIds()).toEqual(['stays']);
  });
});

describe('a downgrade UNPUBLISHES rather than deletes (US4 scenario 2)', () => {
  it('hides the promotion of an owner who may no longer publish', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: false })];
    dealRows = [deal('was-premium', 'cafe')];
    expect(await visibleIds()).toEqual([]);
  });

  it('brings it back when the owner is eligible again, with no re-marking', async () => {
    // The reason this is driven by the LISTING flag rather than by rewriting
    // the merchant's own `inOfertas`: an upgrade restores their promotions
    // without them having to go find each one and tick it again.
    listingRows = [listing('cafe', { covered: true, offersEligible: true })];
    dealRows = [deal('was-premium', 'cafe')];
    expect(await visibleIds()).toEqual(['was-premium']);
  });
});

describe('the merchant’s own choice is separate from the entitlement', () => {
  it('respects a promotion kept profile-only on Premium (US2 scenario 3)', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: true })];
    dealRows = [deal('private', 'cafe', { inOfertas: false })];
    expect(await visibleIds()).toEqual([]);
  });

  it('shows one with no `inOfertas` field at all', async () => {
    // `!== false`, the shape `covered` set. A promotion written before this
    // feature must not vanish from Ofertas on deploy.
    listingRows = [listing('cafe', { covered: true, offersEligible: true })];
    dealRows = [deal('legacy', 'cafe')];
    expect(await visibleIds()).toEqual(['legacy']);
  });
});

describe('records written before this feature keep working', () => {
  it('shows a promotion whose listing has NEITHER flag', async () => {
    // Measured before the migration: all 33 live listings had neither.
    listingRows = [listing('cafe')];
    dealRows = [deal('legacy', 'cafe')];
    expect(await visibleIds()).toEqual(['legacy']);
  });
});

describe('it fails CLOSED', () => {
  it('hides a promotion whose listing cannot be resolved', async () => {
    // A deal whose place the product cannot vouch for does not belong on a
    // surface travelers are invited to act on.
    listingRows = [];
    dealRows = [deal('dangling', 'missing-cafe')];
    expect(await visibleIds()).toEqual([]);
  });

  it('hides a promotion with no listingId at all', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: true })];
    dealRows = [deal('unattached', 'cafe', { listingId: undefined })];
    expect(await visibleIds()).toEqual([]);
  });
});

describe('coverage does not replace the content floor (FR-034)', () => {
  it('hides the promotion of a covered but unfinished place', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: true, photos: [] })];
    dealRows = [deal('promo', 'cafe')];
    expect(await visibleIds()).toEqual([]);
  });
});

describe('a place’s OWN profile asks a different question than Ofertas', () => {
  // US4 scenario 2, and the defect the visual gate caught: `fetchProfileDeals`
  // reused `fetchActiveDeals`, so a promotion that left Ofertas vanished from
  // the business's own profile too. `traveler-place-profile` went 1304px to
  // 1232px — the 72px were a promotion.
  async function profileIds(id: string): Promise<string[]> {
    const { fetchDealsForPlace } = await import('../src/repos/dealsRepo');
    return (await fetchDealsForPlace(id)).map((d) => d.dealId);
  }

  it('KEEPS a promotion whose owner may no longer publish to Ofertas', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: false })];
    dealRows = [deal('was-premium', 'cafe')];
    // Gone from Ofertas...
    expect(await visibleIds()).toEqual([]);
    // ...and still on its own profile. That is the whole of US4 scenario 2.
    expect(await profileIds('cafe')).toEqual(['was-premium']);
  });

  it('KEEPS one the merchant chose to keep off Ofertas', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: true })];
    dealRows = [deal('private', 'cafe', { inOfertas: false })];
    expect(await visibleIds()).toEqual([]);
    expect(await profileIds('cafe')).toEqual(['private']);
  });

  it('HIDES a promotion whose place is suspended', async () => {
    // Coverage is still consulted: a suspended place shows nobody anything,
    // including its own promotions, because the profile itself is gone from
    // every traveler surface.
    listingRows = [listing('cafe', { covered: false, offersEligible: true })];
    dealRows = [deal('promo', 'cafe')];
    expect(await profileIds('cafe')).toEqual([]);
  });

  it('hides a promotion whose place is below the content floor', async () => {
    listingRows = [listing('cafe', { covered: true, offersEligible: true, photos: [] })];
    dealRows = [deal('promo', 'cafe')];
    expect(await profileIds('cafe')).toEqual([]);
  });

  it('returns nothing for a place that does not resolve', async () => {
    listingRows = [];
    dealRows = [deal('dangling', 'missing')];
    expect(await profileIds('missing')).toEqual([]);
  });

  it('returns only THIS place’s promotions', async () => {
    listingRows = [
      listing('cafe', { covered: true, offersEligible: true }),
      listing('bar', { covered: true, offersEligible: true }),
    ];
    dealRows = [deal('mine', 'cafe'), deal('theirs', 'bar')];
    expect(await profileIds('cafe')).toEqual(['mine']);
  });
});
