// Business type and additional-service vocabularies (feature 005).
//
// Two independent classifications, and keeping them independent is the point:
//   - MOOD/vibe  answers "what do I feel like?"  — subjective, multi-select
//   - TYPE       answers "what IS this place?"   — objective, single choice
//
// Before this feature the product only had vibes, and a second field named
// `categories` was written as an exact copy of them — carrying no information,
// and being what the AI Guide received as catalog context. The type replaces it.
//
// Deliberately coarse (FR-042): around ten options, with NO sub-types inside a
// category. Cuisine style belongs to vibes and search, not here.

export const BUSINESS_TYPES = [
  'restaurant-cafe',
  'bar-brewery',
  'nightclub',
  'tour-operator',
  'outdoor-activity',
  'wellness-spa',
  'lodging',
  'transport',
  'shop-crafts',
  'attraction',
  'other',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

/**
 * The generic type used by every curated catalog destination, which has no owner
 * to classify it (FR-043). Also the display fallback for records created before
 * this feature, which are allowed to have no type at all (FR-045).
 */
export const DEFAULT_BUSINESS_TYPE: BusinessType = 'attraction';

/**
 * Types that unlock the restaurant menu section (FR-034/FR-035).
 *
 * This replaces deriving "is this a food business" from vibe tags, which was
 * unreliable in both directions: a provider could omit the "local food" vibe and
 * lose their menu, or select it without serving food at all.
 */
const FOOD_TYPES: readonly BusinessType[] = ['restaurant-cafe', 'bar-brewery'];

export function isFoodType(type: BusinessType | undefined): boolean {
  return type !== undefined && FOOD_TYPES.includes(type);
}

// --- Additional services ----------------------------------------------------
// Predefined and translatable (FR-018) — never free text, so both languages stay
// covered. The set offered depends on the business type: showing "reservations"
// to a transport service, or "guide included" to a shop, weakens the signal.

export const UNIVERSAL_SERVICES = [
  'parking',
  'wifi',
  'card-payment',
  'accessible',
  'pet-friendly',
] as const;

const SERVICES_BY_TYPE: Record<BusinessType, readonly string[]> = {
  'restaurant-cafe': ['reservations', 'outdoor-seating', 'delivery', 'takeaway', 'vegetarian'],
  'bar-brewery': ['outdoor-seating', 'live-music', 'happy-hour', 'craft-beer'],
  nightclub: ['live-music', 'dance-floor', 'vip-area', 'dress-code'],
  'tour-operator': ['guide-included', 'transport-included', 'equipment-included', 'private-tours'],
  'outdoor-activity': ['equipment-included', 'beginner-friendly', 'lessons', 'guide-included'],
  'wellness-spa': ['appointments', 'massage', 'sauna', 'pool'],
  lodging: ['breakfast-included', 'pool', 'air-conditioning', 'kitchen', 'laundry'],
  transport: ['airport-pickup', 'private-driver', 'english-speaking'],
  'shop-crafts': ['local-crafts', 'shipping', 'custom-orders'],
  attraction: ['guided-tours', 'restrooms', 'gift-shop'],
  other: [],
};

/** Every service key that exists, for translation-coverage checks. */
export const ALL_SERVICES: string[] = [
  ...new Set([...UNIVERSAL_SERVICES, ...Object.values(SERVICES_BY_TYPE).flat()]),
];

/**
 * The services a business of this type may advertise: the universal ones plus
 * those specific to the type. An unknown or missing type falls back to the
 * universal set, so an unclassified legacy business still works (FR-045).
 */
export function servicesFor(type: BusinessType | undefined): string[] {
  const specific = type ? (SERVICES_BY_TYPE[type] ?? []) : [];
  return [...UNIVERSAL_SERVICES, ...specific];
}
