// The optional price band a business owner may set (feature 014, FR-065–FR-070).
//
// A RANGE, NEVER AN AMOUNT (FR-067). An exact price is the field that goes stale
// fastest and that nobody returns to update, and a wrong price on a card is
// worse than no price at all.
//
// A KEY, NOT TEXT (FR-066). "Gratis"/"Free" has to translate, and every other
// vocabulary in this product is stored as a key with a label resolved at render
// time. `$$` happens to be language-neutral; `free` is not, and one rule for
// both beats two.
//
// NOT BACKFILLED. The 18 seed destinations carry no band and their cards omit
// the line entirely. They are almost all free public places — El Tunco, El
// Zonte and Playa Las Flores are public beaches; Suchitoto, Concepción de Ataco,
// Juayúa, Apaneca and Alegría are towns; the Malecón and the Historic Center are
// public space — and the ones that charge run $1–$6. Marking them `$$$` would
// state something false about 18 real destinations and break SC-008 ("0
// displayed values are fabricated"), which this product already enforces for
// ratings.

export const PRICE_BANDS = ['free', 'low', 'medium', 'high'] as const;

export type PriceBand = (typeof PRICE_BANDS)[number];

/** i18n key for a band's label. Resolved at render time, never stored. */
export function priceBandLabelKey(band: PriceBand): string {
  return `pricing.${band}`;
}

/** Whether a value is a band this product recognises. */
export function isPriceBand(value: unknown): value is PriceBand {
  return typeof value === 'string' && (PRICE_BANDS as readonly string[]).includes(value);
}

/**
 * The band to display, or `undefined`.
 *
 * `undefined` is the DEFAULT case, not the exceptional one — every seed place
 * and every listing whose owner has not set a band lands here. A card must omit
 * the line rather than render a placeholder, a dash, or a guess (FR-065).
 */
export function priceBandFor(entry: { priceBand?: string }): PriceBand | undefined {
  return isPriceBand(entry.priceBand) ? entry.priceBand : undefined;
}
