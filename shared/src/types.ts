// Shared domain entities for SVTrip. Mirrors specs/.../data-model.md.
// Used by both the client and the Express BFF.
import type { PriceBand } from './pricing.js';
import type { BusinessType } from './businessTypes.js';
import type { LocalizedText } from './i18nContent.js';

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

export type EngagementType = 'profile_view' | 'favorite_click' | 'directions_click';

export interface EngagementEvent {
  type: EngagementType;
  listingId: string;
  createdAt: number;
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
