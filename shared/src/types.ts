// Shared domain entities for SVTrip. Mirrors specs/.../data-model.md.
// Used by both the client and the Express BFF.
import type { PriceBand } from './pricing.js';
import type { BusinessType } from './businessTypes.js';
import type { LocalizedText } from './i18nContent.js';
import type { CalendarDay, TimeOfDay } from './calendarDay.js';
import type { PlanCode } from './subscriptionState.js';

export type Persona = 'traveler' | 'provider';
export type Language = 'en' | 'es';
// No Theme type: SVTrip has a single on-brand light theme (constitution v2.0.0,
// SVTrip_Design_System/). There is no user-selectable theme.

/** Shared vibe/mood tag vocabulary (onboarding vibes == place moods). */
export const MOODS = [
  'romantic-date',
  'extreme-adventure',
  'local-food',
  'nightlife',
  'beach',
  'colonial-town',
  'hiking',
  'culture',
] as const;
export type Mood = (typeof MOODS)[number];

export interface PreferenceSet {
  language: Language;
  vibes: string[];
}

export interface UserProfile {
  uid: string;
  /**
   * The name shown everywhere a traveler is named — including on public reviews
   * and in the operator's claim-approval queue, both of which read this field
   * SERVER-SIDE (`reviewService.ts`, `claimService.ts`).
   *
   * From feature 011 it is DERIVED from `firstName` + `lastName` rather than
   * independently editable, so the two cannot disagree. It is deliberately NOT
   * removed: the two services that read it are untouched by that feature, and
   * leaving it unwritten would silently fall those screens back to their generic
   * placeholder on reviews that are already published.
   */
  displayName: string;
  email: string;
  photoURL?: string;
  persona: Persona;
  onboardingComplete: boolean;
  preferences: PreferenceSet;
  // --- Traveler profile data (feature 011) -----------------------------------
  // All optional on the TYPE because accounts created before that feature carry
  // none of them and stay valid and usable (FR-018). Required-ness is a RULE,
  // checked by `missingProfileFields()`, not a type constraint — encoding it here
  // would make every pre-011 record fail to typecheck for a reason that has
  // nothing to do with correctness.
  firstName?: string;
  lastName?: string;
  gender?: 'masculine' | 'feminine';
  /**
   * Whole number, 13-120. A stored age goes stale — someone who is 30 today is
   * still 30 next year unless they return and edit it. A date of birth would
   * stay accurate on its own; storing the age was the product owner's explicit
   * choice, recorded here so the tradeoff stays visible.
   */
  age?: number;
  /** ISO 3166-1 alpha-2. The CODE, never the localized name (feature 011). */
  countryCode?: string;
  maritalStatus?: 'single' | 'married';
  /** Absent = the account predates feature 011 = grandfathered, never gated. */
  profileVersion?: number;
  createdAt: number;
  updatedAt: number;
}

export type RecommendationKind = 'place' | 'event';

/** Inline card embedded into an assistant message. */
export interface Recommendation {
  refId: string;
  kind: RecommendationKind;
  name: string;
  /**
   * Editorial (curated) rating. NOT a review average — never render it in an
   * average's slot; see `scoreSignalFor` on the client (feature 005, FR-047).
   */
  rating?: number;
  /** Traveler review average, present only when `ratingCount` > 0 (FR-030). */
  ratingAvg?: number;
  ratingCount?: number;
  thumbnailURL?: string;
  lat: number;
  lng: number;
  /** True when `refId` is a provider listing (source of Dashboard engagement metrics). */
  isListing?: boolean;
}

// --- AI Guide plans (feature 004) -------------------------------------------
// The guide answers with a PLAN rather than free prose. Stops reference catalog
// entries by id and carry no descriptive text of their own, which is what makes
// FR-002 ("never recommend a place outside the curated catalog") structurally
// enforceable instead of a hope: a stop cannot describe a place that does not
// exist, because it does not carry a description at all.

/** What a single reply is. Exactly one applies. */
export type PlanOutcome =
  /** 1-4 catalog-backed stops (FR-010). */
  | 'plan'
  /** No usable signal — one question back, no stops (FR-004). */
  | 'clarify'
  /** Nothing in the catalog fits; say so rather than padding (FR-007). */
  | 'no_match'
  /** Not travel/leisure in El Salvador; redirect (FR-006, FR-014). */
  | 'out_of_scope';

/** One stop of a plan. Reference-only by design — see the note above. */
export interface PlanStop {
  /** MUST resolve to a curated catalog place or event. Never a free-text name. */
  catalogId: string;
  /** Position in the plan, contiguous from 1 (FR-011). */
  order: number;
  /** Why this stop fits the original request (FR-012). */
  reason: string;
}

/**
 * One catalog entry the guide has already put in front of this traveler
 * (feature 013).
 *
 * Persisted at `users/{uid}/shown/{catalogId}` — one document per entry, which
 * is what bounds the collection to the catalog's size without a cleanup job
 * (FR-004). An append-only log would be unbounded by construction.
 */
export interface ExposureEntry {
  catalogId: string;
  /** Epoch ms of the last time it appeared in a reply. */
  shownAt: number;
  /**
   * Set once the traveler opened, saved, or asked to get to it (FR-002).
   *
   * Separate from `shownAt` because the two facts call for opposite treatment:
   * shown three times and ignored should stop being offered, while shown once
   * and visited is a success worth learning from. A record that cannot tell
   * them apart supports neither.
   */
  takenUpAt?: number;
  /** How many times it has appeared in a reply. */
  shownCount?: number;
}

/**
 * What the guide is allowed to ASSERT about an entry (feature 013).
 *
 * Each value has a predicate checkable against that entry's own data, and each
 * is used only when true (FR-017). `undefined` is a first-class case rather
 * than a gap: an entry qualifying for nothing is still introducible, because
 * "you haven't tried this" is true of everything unseen and needs no supporting
 * evidence. That fourth case is what lets this ship while only 3 of 36 catalog
 * entries have a review average.
 *
 * A boost is NOT here and never becomes one (FR-018). It may inform ordering;
 * it may not inform a sentence.
 */
export type PlaceClaim = 'well-rated' | 'new' | 'popular';

/** One unseen entry offered alongside a reply. At most one per reply (FR-012). */
export interface Introduction {
  /** Validated against the catalog exactly like a plan stop (FR-024). */
  catalogId: string;
  /** Absent when the entry qualifies for no claim. */
  claim?: PlaceClaim;
  /**
   * i18n key, resolved on the surface — replies are persisted, so rendered text
   * would freeze a stored introduction in whichever language produced it.
   */
  copyKey: string;
}

/**
 * What the guide asks about when it cannot tell which catalog entries fit
 * (feature 012). Ordered by how decisively each one narrows the catalog:
 * `mood` ranks first because it is what entries are actually tagged with.
 */
export type ClarifyDimension = 'mood' | 'companion' | 'time';

/** One tappable answer to a clarifying question (feature 012, FR-006). */
export interface ClarifyOption {
  /**
   * Stable identity, not a rendered label: a mood KEY for `mood` (so an
   * admin-added mood works with no code change), or an authored token for
   * `companion` / `time`. Carrying the key is what lets the server fold the
   * answer into the next request in code instead of re-interpreting prose.
   */
  value: string;
  /**
   * i18n key, resolved on the surface — so a stored reply renders in the
   * language the traveler is using NOW, not the one it was generated in.
   */
  labelKey: string;
  /**
   * Resolved through `moodIcon(key)`, which falls back rather than rendering an
   * undefined icon for an admin-created mood (feature 010).
   */
  icon?: string;
}

/** The assistant's answer to one prompt. */
export interface GeneratedPlan {
  outcome: PlanOutcome;
  /** Short framing prose shown above the stops. Empty for non-plan outcomes. */
  intro: string;
  /** Ordered stops. Empty unless outcome is 'plan'. */
  stops: PlanStop[];
  /** Present only when outcome is 'clarify'; at most one question (FR-004). */
  clarifyingQuestion?: string;
  /**
   * 2-4 tappable answers (feature 012, FR-006). Present only when outcome is
   * 'clarify'.
   *
   * ADDITIVE AND OPTIONAL, deliberately: conversations are persisted per
   * traveler and the guide screens still render shapes that predate feature
   * 004. Absent means "a question with no options" — exactly what ships today.
   */
  clarifyOptions?: ClarifyOption[];
  /**
   * Identifies this question so an answer can be matched to it, and a stale one
   * ignored (feature 012, FR-014).
   */
  clarifyId?: string;
  /**
   * At most one unseen entry offered alongside the plan (feature 013, FR-012).
   *
   * ADDITIVE AND OPTIONAL: conversations are persisted, and a reply generated
   * before this feature carries none. Absent means "no invitation", which is
   * exactly today's behaviour.
   */
  introduction?: Introduction;
}

export type MessageRole = 'user' | 'assistant';
export type MessageStatus = 'complete' | 'streaming' | 'error';

export interface Message {
  messageId: string;
  role: MessageRole;
  text: string;
  createdAt: number;
  /**
   * @deprecated Pre-004 shape. Conversations saved before the guide produced
   * plans still carry this, so the UI keeps rendering it — see feature 004
   * compatibility tasks. New turns store `plan` instead.
   */
  recommendations?: Recommendation[];
  /** The validated plan for this assistant turn (feature 004). */
  plan?: GeneratedPlan;
  status: MessageStatus;
}

export interface Conversation {
  conversationId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  lastMessagePreview: string;
  recommendationCount: number;
}

export interface Place {
  placeId: string;
  name: string;
  description: string;
  moods: string[];
  categories: string[];
  rating: number;
  lat: number;
  lng: number;
  photos: string[];
  trending: boolean;
  colonialTown: boolean;
  keywords: string[];
  source: 'seed' | 'listing';
  /** Sponsored placement: the owning provider has a rank-boost entitlement (US8). */
  boosted?: boolean;
  /**
   * Whether a live subscription covers this place (feature 018, FR-016).
   *
   * OPAQUE ON PURPOSE. `listings` is `allow read: if signedIn()`, so a
   * `planCode` or a status enum here would break FR-015 whatever the UI does.
   * `undefined` means "written before feature 018" and reads as VISIBLE —
   * `covered !== false`, never `covered === true` (see `travelerVisible`).
   *
   * Written only by the BFF's subscription service (FR-026/FR-027).
   */
  covered?: boolean;
  /**
   * Owning provider, present only when `source === 'listing'`. Curated catalog
   * destinations have no owner, which is why the profile hides owner-only
   * affordances for them (feature 005).
   */
  ownerUid?: string;
  /** Business profile fields (feature 005) — all optional so nothing existing breaks. */
  businessType?: BusinessType;
  bannerURL?: string;
  gallery?: string[];
  services?: string[];
  menuImages?: string[];
  /** Server-written review aggregate — see the note on BusinessProfileFields. */
  ratingAvg?: number;
  ratingCount?: number;
  /**
   * When this entry joined the catalog (feature 013).
   *
   * Optional because seed places predate the `listings` collection and carry no
   * timestamp at all. An entry without one is simply never described as "new" —
   * absence is not newness, the same way absence of reviews is not a low rating.
   */
  createdAt?: number;
  /**
   * Bilingual content carried over from the underlying listing (feature 006).
   * Read through `resolveLocalized()`, never directly.
   */
  nameI18n?: LocalizedText;
  descriptionI18n?: LocalizedText;
  /** Absent means the entry predates feature 006 and skips the minimums. */
  contentVersion?: number;
  /** Carried from the listing; see the note there (FR-032). */
  phone?: string;
  whatsapp?: string;
  /**
   * What this costs, as a RANGE (feature 014).
   *
   * Optional, and absent on all 18 seed destinations — most of them free
   * public beaches, towns and plazas — whose cards omit the line entirely.
   * Assigning them a band would state something false about real places and
   * break SC-008.
   *
   * Carried here by BOTH `listingToPlace` mappers. A range rather than an
   * amount: an exact price goes stale fastest, and a wrong one is worse than
   * none at all.
   */
  priceBand?: PriceBand;
}

export interface SvEvent {
  eventId: string;
  title: string;
  description: string;
  lat: number;
  lng: number;
  startAt: number;
  endAt: number;
  trending: boolean;
  keywords: string[];
}

export interface OpeningHour {
  day: number; // 0 = Sunday .. 6 = Saturday
  open: string; // "09:00"
  close: string; // "17:00"
  closed: boolean;
}

export interface Listing {
  listingId: string;
  ownerUid: string;
  name: string;
  description: string;
  photos: string[];
  lat: number;
  lng: number;
  openingHours: OpeningHour[];
  moods: string[];
  categories: string[];
  rating: number;
  active: boolean;
  /** Denormalized from the owner's subscription rank-boost entitlement (US8). */
  boosted?: boolean;
  /**
   * Whether a live subscription covers this place (feature 018, FR-016).
   *
   * OPAQUE ON PURPOSE. `listings` is `allow read: if signedIn()`, so a
   * `planCode` or a status enum here would break FR-015 whatever the UI does.
   * `undefined` means "written before feature 018" and reads as VISIBLE —
   * `covered !== false`, never `covered === true` (see `travelerVisible`).
   *
   * Written only by the BFF's subscription service (FR-026/FR-027).
   */
  covered?: boolean;
  /**
   * Whether this owner may publish promotions to Ofertas (feature 018).
   *
   * Server-written, like `covered`, and opaque for the same reason. It drives
   * US4 scenario 2: a Premium account dropping to Básico loses Ofertas and
   * keeps the promotion on its own profile — without the product rewriting the
   * merchant's own `inOfertas` choice, so an upgrade restores it.
   */
  offersEligible?: boolean;
  /**
   * Discover spotlight membership, carried over when the curated catalog was
   * handed to a provider account. **Not client-writable** (security rules pin
   * both), so a provider cannot place their own business in "Trending" or
   * "Colonial towns".
   */
  trending?: boolean;
  colonialTown?: boolean;
  /** Search terms from the curated catalog; falls back to the name. */
  keywords?: string[];
  /**
   * Bilingual content (feature 006). **Additive**: these sit beside `name` and
   * `description`, they do not replace them. Resolve through
   * `resolveLocalized()` — never read them directly, or two surfaces will
   * disagree about which language to fall back to (FR-014 to FR-017).
   */
  nameI18n?: LocalizedText;
  descriptionI18n?: LocalizedText;
  /**
   * Stamped on every manager save from feature 006 onward. Its **absence** means
   * the entry predates the feature and is exempt from the publication minimums
   * until its manager saves it (FR-009b) — which is the only reason 18 real,
   * photoless businesses stay visible.
   */
  contentVersion?: number;
  /**
   * Contact numbers in full international format (feature 006, FR-032).
   * Absent means the business has none, which is normal — a national park has no
   * phone — and the contact actions simply do not render for it.
   */
  phone?: string;
  whatsapp?: string;
  /** Optional price range the owner sets (feature 014). Never required —
   *  it must not join the publication floor, which guards regression only. */
  priceBand?: PriceBand;
  /** Business profile fields (feature 005) — all optional so nothing existing breaks. */
  businessType?: BusinessType;
  bannerURL?: string;
  gallery?: string[];
  services?: string[];
  menuImages?: string[];
  /**
   * Review aggregate. **Server-written only** — clients are denied by the
   * security rules, and a provider must never be able to influence their own
   * score. Denormalized here (rather than computed per view) because a card in a
   * list and the profile must never show different numbers (SC-009).
   *
   * Absent or zero `ratingCount` means the entry has NO average and must display
   * none — an editorial rating is not a substitute (FR-030, FR-047).
   */
  ratingAvg?: number;
  ratingCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface DealCost {
  amount: number;
  currency: string;
  original?: number;
  discountPct?: number;
}

export interface Deal {
  dealId: string;
  ownerUid: string;
  listingId?: string;
  title: string;
  description: string;
  /** Bilingual promotion copy (feature 006). Additive, like the listing's. */
  titleI18n?: LocalizedText;
  descriptionI18n?: LocalizedText;
  cost: DealCost;
  activeFrom: number;
  activeTo: number;
  image?: string;
  /**
   * Whether this promotion is published to the Ofertas surface (feature 018,
   * FR-013). Premium only.
   *
   * A CHOICE, not a consequence of the plan: US2 scenario 3 says a Premium
   * merchant "can mark it to appear in Ofertas", so a promotion can be
   * profile-only even on Premium.
   *
   * Read as `!== false`, the same shape as `covered` and for the same reason: a
   * promotion written before this feature has no such field and must not vanish
   * from Ofertas on deploy.
   *
   * The ENTITLEMENT is the hard rule and this is only the merchant's
   * preference. A stale `true` left over from a Premium account that dropped to
   * Básico must not keep a promotion in Ofertas — that is US4 scenario 2, and
   * it is enforced where Ofertas reads rather than here.
   */
  inOfertas?: boolean;
}

// --- Reviews (feature 005) --------------------------------------------------
// The product's FIRST user-generated content: written by one traveler, readable
// by everyone, about a resource owned by someone else. That is a new security
// shape, which is why writes go through the BFF and rules deny clients outright.

/** Which collection a reviewed target lives in. */
export type ReviewTargetKind = 'place' | 'listing';

/** Max characters for review and reply text (FR-033). */
export const REVIEW_TEXT_MAX = 1000;

/** The business owner's single public response to a review (FR-024). */
export interface ReviewReply {
  text: string;
  /** Must be the owner of the reviewed target. */
  authorUid: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * One traveler's rating of one target.
 *
 * Stored at the deterministic id `{targetId}_{authorUid}`, which makes
 * one-review-per-traveler structurally impossible to violate (FR-020) — there is
 * nowhere to put a second one.
 */
export interface Review {
  reviewId: string;
  targetId: string;
  targetKind: ReviewTargetKind;
  /** Taken from the verified token, never from a request body. Immutable. */
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string;
  /** Integer 1-5. */
  rating: number;
  comment?: string;
  createdAt: number;
  updatedAt: number;
  reply?: ReviewReply;
}

/** Aggregate shown wherever a score appears. Server-written only. */
export interface ScoreSummary {
  ratingAvg: number;
  ratingCount: number;
}

/** Build the deterministic review id. Single source of truth for the scheme. */
export function reviewIdFor(targetId: string, authorUid: string): string {
  return `${targetId}_${authorUid}`;
}

// --- Business claims (feature 006) ------------------------------------------
// A request to manage a catalog entry. Ownership itself is NOT stored here —
// `Listing.ownerUid` remains the only answer to "who manages this". Claiming is
// a request precisely because granting yourself ownership of a document you do
// not own is what the security model exists to prevent: read literally, an
// unapproved claim would let the first account to ask take over El Tunco and
// rewrite it.

export type ClaimStatus = 'pending' | 'approved' | 'refused' | 'withdrawn';

/** `handover` when the entry already has a manager; the server decides which. */
export type ClaimKind = 'claim' | 'handover';

export const CLAIM_MESSAGE_MAX = 500;

export interface BusinessClaim {
  claimId: string;
  listingId: string;
  /**
   * The business's name as it stood when the claim was filed, resolved
   * server-side. Without it the approval queue shows a document id, and an
   * operator cannot decide who should manage "Xk3mZq8..." — the one screen in
   * the product where a wrong decision hands a stranger someone else's profile.
   */
  listingName: string;
  requesterUid: string;
  /** Resolved server-side from `users/{uid}` — a client-supplied name would let
   *  a requester misrepresent themselves in the operator's approval queue. */
  requesterName: string;
  kind: ClaimKind;
  status: ClaimStatus;
  message?: string;
  createdAt: number;
  updatedAt: number;
  decidedByUid?: string;
  decisionNote?: string;
}

/**
 * Deterministic claim id — one open request per person per entry, as a property
 * of the key rather than a check that can be forgotten. Note what it does NOT
 * prevent: two *different* accounts each holding a pending claim on the same
 * entry. Only the approval step can enforce one manager.
 */
export function claimIdFor(listingId: string, requesterUid: string): string {
  return `${listingId}_${requesterUid}`;
}

export type EngagementType =
  | 'profile_view'
  | 'favorite_click'
  | 'directions_click'
  // Feature 018. Per-promotion performance was described during clarification
  // as "derivable from `byListing`". It is not, and research R7 corrects it:
  // `dealId` was recorded NOWHERE in the engagement path, and `byListing`
  // attributes a count to a BUSINESS, not to a promotion. So the promotion had
  // to become an event of its own.
  | 'promotion_view'
  | 'promotion_click';

export interface EngagementEvent {
  type: EngagementType;
  listingId: string;
  createdAt: number;
  /**
   * Which SURFACE the traveler came from (feature 018, FR-039).
   *
   * A surface, NEVER a person. Engagement is anonymous in this product by a
   * standing decision — feature 013 established it and 016 reaffirmed it, where
   * a business must not learn it appears in someone's Trip — and a paid metric
   * is not a reason to reopen that.
   *
   * OPTIONAL, and that is load-bearing in the same way `ChatHistoryTurn.stops`
   * was in feature 015: an installed app that has not updated sends nothing and
   * degrades to exactly today's behaviour. Events written before this feature
   * have no origin, which the dashboard reports as "not attributable" rather
   * than as a misleading zero — the precedent `metricsDaily.byListing` set in
   * feature 006.
   */
  origin?: EngagementOrigin;
  /** Only on the two promotion events. Optional for the same reason. */
  dealId?: string;
}

export interface MetricAggregate {
  profileViews: number;
  favoriteClicks: number;
  directionsClicks: number;
  activePromotions: number;
  date: string; // yyyymmdd
}

/** Highly-rated threshold used by Spin the Wheel and "For You" (FR-015). */
export const HIGHLY_RATED_THRESHOLD = 4.3;

// ---------------------------------------------------------------------------
// Trips (feature 016)
//
// A Trip is a named, dated collection of catalog places one traveler owns and
// arranges. Two origins — built by hand, or kept from a guide plan — and
// identical behaviour afterwards.
//
// Nothing here is added to `Place` or `Listing`: a stop POINTS at the catalog,
// and the catalog does not know about Trips.
// ---------------------------------------------------------------------------

/** How a Trip began. Never changes, and never changes how the Trip can be edited. */
export type TripOrigin = 'manual' | 'guide';

export interface Trip {
  tripId: string;
  /** Non-empty (FR-002). What the traveler calls it. */
  name: string;
  /**
   * A day, not an instant — see `CalendarDay`. The floor for every stop's
   * date (FR-020), compared as a string so no timezone enters the comparison.
   */
  startDate: CalendarDay;
  origin: TripOrigin;
  /**
   * Present only when `origin` is 'guide'. Which assistant turn this was kept
   * from — what makes FR-041 ("the same reply cannot be kept twice") answerable
   * by a lookup rather than by scanning every Trip's stops.
   */
  sourceMessageId?: string;
  createdAt: number;
  /** Moves when the Trip or any of its stops changes, so the list orders by recency. */
  updatedAt: number;
}

export interface TripStop {
  /**
   * GENERATED, never the catalog id. FR-014 requires the same place twice in
   * one Trip, and keying by catalog id makes that impossible by construction —
   * which is exactly what it already does to favorites.
   */
  stopId: string;
  /** A reference, never a copy: resolved at read time so a renamed business renames everywhere. */
  catalogId: string;
  /** Which part of the catalog to resolve against — the three favorites already distinguishes. */
  kind: 'place' | 'listing' | 'event';
  /** Absent means unscheduled. Never earlier than the Trip's `startDate` (FR-020). */
  date?: CalendarDay;
  /** Only valid alongside a `date` (FR-021). Clearing the date clears this (FR-023). */
  time?: TimeOfDay;
  /**
   * Orders the stop within the UNSCHEDULED group (FR-028). Deliberately NOT
   * cleared when a stop is scheduled: clearing its date returns it to where the
   * traveler had put it rather than to an arbitrary place in an arrangement
   * they made by hand.
   */
  position: number;
  /**
   * Present only for stops kept from a guide plan — the guide's words, rendered
   * as such (FR-040). Optional rather than empty-string on purpose: absent means
   * nobody gave a reason, and a hand-added stop must not render an empty quote.
   */
  reason?: string;
  /** Tiebreaker when two stops share a date and time, and the default order before any drag. */
  addedAt: number;
}

// ---------------------------------------------------------------------------
// Merchant subscriptions (feature 018)
// ---------------------------------------------------------------------------

/**
 * One subscription per ACCOUNT, covering the places that account manages.
 *
 * **This reverses the source document's FR-004**, which keys a subscription to
 * a place. The product owner chose per-account billing for conversion speed
 * over revenue per account, with the consequence raised first and accepted: a
 * chain of ten locations pays $50 rather than $500 (spec D10). Side effect
 * worth knowing — the model this replaces was ALREADY account-keyed, so the
 * re-keying the spec first assumed is work that does not happen.
 *
 * **No `status` field.** The state is derived from these facts (FR-043),
 * because the product has no scheduler to rewrite a stored one and a missed
 * write fails silently in the worst direction: a suspended place left visible,
 * or a paying merchant left hidden.
 */
export interface MerchantSubscription {
  planCode: PlanCode;
  /** When the plan was chosen — the H4 signal FR-003 exists for. */
  chosenAt: number;
  /** Whether a payment is currently in force. Set by the team today (FR-021). */
  paymentActive: boolean;
  /** End of the 90-day launch discount, when one applies (FR-005). */
  campaignEndsAt?: number;
  /** End of the 7-day cushion, once one has started (FR-008). */
  graceEndsAt?: number;
  /** End of the period already paid for (FR-019). */
  currentPeriodEndsAt?: number;
  /** Set when cancellation is REQUESTED; it takes effect at the period's end. */
  cancelledAt?: number;
  /** Básico only: the single place it covers (FR-050). */
  coveredPlaceId?: string;
  /** FR-021's audit trail. All three are written together or not at all. */
  manualBy?: string;
  manualNote?: string;
  manualAt?: number;
}

/**
 * A plan's live configuration, read from `subscriptionPlans/{code}`.
 *
 * Exists so FR-001 holds — prices change without a release — and is readable
 * by any signed-in account because the merchant's chooser renders from it. It
 * holds PRICES, never anybody's subscription, which is why that read does not
 * touch FR-015.
 */
export interface SubscriptionPlanConfig {
  code: PlanCode;
  monthlyPriceUsd: number;
  launchDiscountPercent: number;
  nameI18n?: LocalizedText;
  descriptionI18n?: LocalizedText;
  updatedBy?: string;
  updatedAt?: number;
}

/**
 * The one campaign record, at `launchCampaign/current`.
 *
 * `launchAt` is **undefined until the team sets it**, and while it is undefined
 * the enrollment window is CLOSED (FR-049) — so no merchant silently receives a
 * 90-day discount before anyone opened the campaign. Failing closed here costs
 * a manual step; failing open gives the campaign away.
 */
export interface LaunchCampaignConfig {
  launchAt?: number;
  enrollmentWindowMonths: number;
  discountDays: number;
  updatedBy?: string;
  updatedAt?: number;
}

/** Where a traveler came from when an engagement event fired (FR-039). */
export type EngagementOrigin =
  | 'discover'
  | 'search'
  | 'guide'
  | 'deals'
  | 'landing'
  | 'direct';
