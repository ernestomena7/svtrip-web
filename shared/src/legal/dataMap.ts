/**
 * Every collection in `firestore.rules`, and where the policy accounts for it (feature 022, FR-018).
 *
 * **This file is the gap detector, and it exists because discipline alone did not hold.**
 * `docs/privacy-data-inventory.md` was THREE FEATURES STALE when this feature started: it knew
 * nothing of Trips, the traveler phone, reservations or device tokens, and a re-read for this
 * feature found two more that no earlier document named — `reviewReports` and `businessClaims`.
 * A one-time re-measure is discipline. This makes it a test.
 *
 * `shared/tests/legal.test.ts` reads the real `firestore/firestore.rules`, extracts every
 * collection, and fails unless each one is in EXACTLY ONE of the two maps below. So adding a
 * collection to the rules without deciding what the policy says about it fails the build — and the
 * failure names the collection.
 *
 * **Two kinds of entry, and neither can be left blank:**
 *
 *   - `DATA_MAP`: personal data. Points at the policy section that discloses it, and that section
 *     must exist in BOTH languages (a row naming a renamed or deleted section would pass the lists
 *     and describe nothing).
 *   - `NOT_PERSONAL`: with a REASON. An allow-list with no reasons is a way to make a gate pass by
 *     adding to it.
 *
 * What this does NOT prove: that the section actually SAYS the right thing. A map can say
 * "reservations -> reservations-shared" while that section is wrong. That is a human reading
 * (SC-002, SC-003) and no gate substitutes for it.
 */

export interface DataMapEntry {
  /** The `LegalSection.id` in the privacy policy that discloses this collection. */
  section: string;
  /** One line on what it holds, so the next editor does not have to re-derive it. */
  holds: string;
}

export const DATA_MAP: Record<string, DataMapEntry> = {
  users: {
    section: 'data-collected',
    holds: 'Account: email, name, age, gender, country, optional marital status, phone, preferences.',
  },
  favorites: { section: 'data-collected', holds: 'Every place a traveler saved.' },
  conversations: {
    section: 'retention',
    holds: 'Guide conversations. Persisted per message and read back on every visit.',
  },
  messages: { section: 'retention', holds: 'The text of each guide message.' },
  shown: {
    section: 'data-collected',
    holds: 'Which catalog entries the guide has put in front of a traveler, and when.',
  },
  trips: { section: 'data-collected', holds: "A traveler's named, dated plans." },
  stops: { section: 'data-collected', holds: 'The places inside a Trip, with optional date and time.' },
  devices: {
    section: 'data-collected',
    holds: 'Push tokens. RULES ONLY — nothing stores one until feature 020 US4 ships.',
  },
  reservations: {
    section: 'reservations-shared',
    holds: "A reservation request. The merchant READS the traveler's name, email and phone.",
  },
  businessClaims: {
    section: 'data-collected',
    holds: "A request to manage a business: the requester's name and an optional free-text message.",
  },
  reviewReports: {
    section: 'data-collected',
    holds: 'Who reported which review. Server-only; no client can read it.',
  },
  reviews: {
    section: 'reviews-public',
    holds: "Public reviews. Writing one publishes the author's name.",
  },
  providerProfiles: {
    section: 'data-collected',
    holds: "A merchant's subscription: plan code, dates and a payment-active flag.",
  },
  // `engagementEvents` and `metricsDaily` are DELIBERATELY anonymous — they hold a listing and the
  // type of interaction and NO traveler identifier. They are in this map, not NOT_PERSONAL, because
  // the policy makes a positive promise about them (`anonymous-analytics`), and a promise has to be
  // tracked or it quietly stops being true.
  engagementEvents: {
    section: 'anonymous-analytics',
    holds: 'One record per traveler interaction, with NO traveler identifier.',
  },
  metricsDaily: { section: 'anonymous-analytics', holds: 'Daily totals per business.' },
  listings: {
    section: 'data-collected',
    holds: 'A business listing. Carries ownerUid, readable by every signed-in account.',
  },
};

export const NOT_PERSONAL: Record<string, string> = {
  places: 'Curated catalog content about destinations, with no person attached.',
  events: 'Catalog content about events, with no person attached.',
  deals: 'A business promotion. Content a merchant chose to publish, not a person’s data.',
  businessTypes: 'An admin-managed vocabulary of business categories.',
  moods: 'An admin-managed vocabulary of moods.',
  additionalServices: 'An admin-managed vocabulary of services a business can declare.',
  subscriptionPlans: 'The plan catalog: names, prices and limits. Identical for every account.',
  launchCampaign: 'A single campaign window configuration. Not tied to anyone.',
};

/**
 * Every `match /<name>/{id}` in a rules file — roots and subcollections both, never the
 * `/{document=**}` catch-all, and never a match inside a comment.
 *
 * A REGEX over rules text, not a parser, and that is a deliberate trade: rules have a small, stable
 * grammar, and a real parser would be a dependency for one test. The cost is that an unusual form —
 * a `match` split across lines, or built from a function — would be missed, which would make the
 * detector SILENT rather than wrong. The first test case in `legal.test.ts` guards that: it
 * requires the extractor to find at least twenty collections, so a parser that quietly returned
 * nothing cannot pass every other case vacuously.
 */
export function extractCollections(rules: string): string[] {
  const out = new Set<string>();
  const uncommented = rules
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => {
      const i = line.indexOf('//');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
  const re = /match\s+\/([A-Za-z][A-Za-z0-9_]*)\/\{[^}]+\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(uncommented)) !== null) out.add(m[1]);
  // `match /databases/{database}/documents` is the ENVELOPE every rules file opens with, not a
  // collection. The first version of this function returned it, and the gap detector's own test
  // caught that on its first run — reporting `databases` as an unmapped collection.
  out.delete('databases');
  return [...out];
}
