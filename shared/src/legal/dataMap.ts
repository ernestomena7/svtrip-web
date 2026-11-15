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
  profiles: {
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
  trip_stops: { section: 'data-collected', holds: 'The places inside a Trip, with optional date and time.' },
  devices: {
    section: 'data-collected',
    holds: 'Push tokens, one per account per phone installation (feature 020 US4). Written only after the person taps "Activar avisos"; deleted on sign-out and when FCM reports the token dead.',
  },
  reservations: {
    section: 'reservations-shared',
    holds: "A reservation request. The merchant READS the traveler's name, email and phone.",
  },
  business_claims: {
    section: 'data-collected',
    holds: "A request to manage a business: the requester's name and an optional free-text message.",
  },
  review_reports: {
    section: 'data-collected',
    holds: 'Who reported which review. Server-only; no client can read it.',
  },
  reviews: {
    section: 'reviews-public',
    holds: "Public reviews. Writing one publishes the author's name.",
  },
  provider_profiles: {
    section: 'data-collected',
    holds: "A merchant's subscription: plan code, dates and a payment-active flag.",
  },
  // `engagement_events` and `metrics_daily` are DELIBERATELY anonymous — they hold a listing and the
  // type of interaction and NO traveler identifier. They are in this map, not NOT_PERSONAL, because
  // the policy makes a positive promise about them (`anonymous-analytics`), and a promise has to be
  // tracked or it quietly stops being true.
  engagement_events: {
    section: 'anonymous-analytics',
    holds: 'One record per traveler interaction, with NO traveler identifier.',
  },
  metrics_daily: { section: 'anonymous-analytics', holds: 'Daily totals per business.' },
  listings: {
    section: 'data-collected',
    holds: 'A business listing. Carries ownerUid, readable by every signed-in account.',
  },
  plan_changes: {
    section: 'data-collected',
    holds: "Each change to a merchant's plan: the account, the plan, the price in effect and its dates. Server-only.",
  },
  legacy_orphan_profiles: {
    section: 'data-collected',
    holds: 'Profiles imported at feature 023 that had no login account (R7). Kept, readable by nobody.',
  },
};

export const NOT_PERSONAL: Record<string, string> = {
  places: 'Curated catalog content about destinations, with no person attached.',
  events: 'Catalog content about events, with no person attached.',
  deals: 'A business promotion. Content a merchant chose to publish, not a person’s data.',
  business_types: 'An admin-managed vocabulary of business categories.',
  moods: 'An admin-managed vocabulary of moods.',
  additional_services: 'An admin-managed vocabulary of services a business can declare.',
  subscription_plans: 'The plan catalog: names, prices and limits. Identical for every account.',
  launch_campaign: 'A single campaign window configuration. Not tied to anyone.',
  assistant_usage_daily:
    'Feature 024: daily totals of AI-assistant usage per tool and per stated context value — (day, metric, value, count) has no column for a person, an IP or a query (FR-026).',
};

/**
 * Every `create table [if not exists] public.<name>` in SQL migration text, never one inside a `--`
 * comment. Feature 023 moved the data from Firestore (whose `match` blocks this used to read) to
 * Postgres, so the guard reads the migrations now; reading the retired rules file would keep it
 * green forever while new tables went undisclosed.
 *
 * A regex, not a SQL parser, for the same trade the rules version made: a table created by an
 * unusual form (a `do` block, a dynamic `execute`) would be missed, making the detector SILENT
 * rather than wrong — which the ">= 20 tables" case in `legal.test.ts` guards against.
 */
export function extractCollections(sql: string): string[] {
  const out = new Set<string>();
  const uncommented = sql
    .split('\r').join('')

    .split('\n')
    .map((line) => {
      const i = line.indexOf('--');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(uncommented)) !== null) out.add(m[1].toLowerCase());
  return [...out];
}
