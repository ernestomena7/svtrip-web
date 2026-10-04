// Which places a subscription covers (feature 018, FR-050/FR-051/FR-035a).
//
// This is where Básico's one-place cap actually lives, and the reason is
// measured rather than chosen: FIRESTORE RULES CANNOT COUNT. There is no
// aggregation in rules, so "this account already has a listing" is not
// expressible there, and the nearest thing — a `get()` against a stored counter
// — reintroduces exactly the stored-derived-value trap FR-043 rejects.
//
// So a second place on Básico is not REFUSED at creation; it is simply not
// COVERED, and therefore not visible. A client that bypasses the UI gains an
// invisible listing, which is not an exploit.
import { describe, it, expect } from 'vitest';
import { coversPlace, coveredPlaceIds, type CoverageInput } from '../src/subscriptionCoverage.js';

const PLACES = ['el-tunco', 'suchitoto', 'ataco'];

function input(over: Partial<CoverageInput> = {}): CoverageInput {
  return {
    planCode: 'premium',
    state: 'active',
    managedPlaceIds: PLACES,
    ...over,
  };
}

describe('premium covers every place the account manages', () => {
  // FR-051. The product owner's per-account billing decision: one price, all
  // the places. The cost is recorded in spec D10 — a chain of ten pays $50.
  it('covers all three', () => {
    const sub = input();
    for (const id of PLACES) expect(coversPlace(sub, id)).toBe(true);
  });

  it('lists all three as covered', () => {
    expect(coveredPlaceIds(input())).toEqual(PLACES);
  });

  it('does not cover a place the account does not manage', () => {
    expect(coversPlace(input(), 'somewhere-else')).toBe(false);
  });
});

describe('basico covers exactly one place', () => {
  // FR-050. This is what makes the plan step sell CAPACITY and not only
  // visibility: a merchant who opens a second location has to be on Premium.
  it('covers the recorded place', () => {
    expect(coversPlace(input({ planCode: 'basico', coveredPlaceId: 'suchitoto' }), 'suchitoto')).toBe(
      true,
    );
  });

  it('does NOT cover the other places the account manages', () => {
    const sub = input({ planCode: 'basico', coveredPlaceId: 'suchitoto' });
    expect(coversPlace(sub, 'el-tunco')).toBe(false);
    expect(coversPlace(sub, 'ataco')).toBe(false);
  });

  it('lists exactly one covered place', () => {
    expect(coveredPlaceIds(input({ planCode: 'basico', coveredPlaceId: 'ataco' }))).toEqual(['ataco']);
  });

  it('covers nothing when no place has been chosen yet', () => {
    // A Básico subscription with no `coveredPlaceId` is an incomplete record,
    // and the safe reading is "covers nothing" rather than "covers the first
    // one" — picking for the merchant is what US4 scenario 1b forbids.
    const sub = input({ planCode: 'basico', coveredPlaceId: undefined });
    expect(coveredPlaceIds(sub)).toEqual([]);
    for (const id of PLACES) expect(coversPlace(sub, id)).toBe(false);
  });

  it('covers nothing when the recorded place is no longer managed', () => {
    // Ownership was handed over. The subscription belongs to the ACCOUNT and
    // does not travel with the place (spec Edge Cases), so the stale id must
    // not keep granting coverage.
    const sub = input({ planCode: 'basico', coveredPlaceId: 'handed-away' });
    expect(coveredPlaceIds(sub)).toEqual([]);
  });
});

describe('the internal plan covers everything, unlimited', () => {
  // FR-035a. Measured: the house account manages 33 of 33 catalog entries.
  it('covers all managed places', () => {
    const many = Array.from({ length: 33 }, (_, i) => `place-${i}`);
    const sub = input({ planCode: 'internal', managedPlaceIds: many });
    expect(coveredPlaceIds(sub)).toHaveLength(33);
    expect(coversPlace(sub, 'place-32')).toBe(true);
  });
});

describe('a state that is not visible-bearing covers nothing', () => {
  // FR-009. The whole point of suspension: the places stop being visible. If
  // coverage survived it, nothing downstream would hide anything.
  it.each(['suspended', 'pending_payment'] as const)('%s covers nothing', (state) => {
    const sub = input({ state });
    expect(coveredPlaceIds(sub)).toEqual([]);
    for (const id of PLACES) expect(coversPlace(sub, id)).toBe(false);
  });

  it.each(['campaign', 'active', 'grace', 'cancelled'] as const)('%s still covers', (state) => {
    // Grace is the one that matters here: the place STAYS VISIBLE for 7 days
    // (FR-008), which is the source document's own mitigation.
    expect(coversPlace(input({ state }), 'el-tunco')).toBe(true);
  });
});
