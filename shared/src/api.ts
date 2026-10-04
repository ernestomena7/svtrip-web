// BFF HTTP contract types. Mirrors specs/.../contracts/bff-api.md.

import type {
  EngagementOrigin,
  Language,
  Place,
  Recommendation,
  EngagementType,
  GeneratedPlan,
  ExposureEntry,
} from './types.js';

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
  /**
   * The stops this assistant turn produced, so the model can see the list it
   * showed (feature 015, US2).
   *
   * The reply that reaches the traveler is `plan.intro` plus rendered cards, and
   * only the intro is streamed as text — so only the intro is what the client
   * persists and sends back. The stops live in `Message.plan`, and until now they
   * never travelled. That is why "quitá la opción 2" did nothing: the model was
   * being asked to count a list it had never been shown. No wording fixes that.
   *
   * **Optional, and the optionality is load-bearing.** The mobile client ships
   * inside an installed Android app. One that has not updated sends no stops, its
   * assistant turns compose to the intro alone, and it behaves exactly as it does
   * today — which is the degradation feature 012 established for
   * `answersClarifyId` and 013 for `seen`.
   *
   * **Ids, not names.** The server resolves each id against the catalog it has
   * already assembled for this turn, in the traveler's language. Accepting names
   * would let a caller put arbitrary words into the history the model reads, with
   * no way for the server to tell an honest name from an invented one — the same
   * reason the catalog allow-list is assembled server-side (Constitution I).
   */
  stops?: ChatHistoryStop[];
}

/** One stop of a previous reply, as it travels back in history. */
export interface ChatHistoryStop {
  /** Resolved against the catalog server-side; an id that no longer exists is dropped. */
  catalogId: string;
  /** Contiguous from 1, matching what the traveler saw on screen. */
  order: number;
}

/** Where a prompt came from — a typed message or a tapped suggestion (FR-009). */
export type ChatPromptSource = 'typed' | 'suggested';

export interface ChatRequest {
  conversationId: string | null;
  message: string;
  language: Language;
  history?: ChatHistoryTurn[];
  /**
   * The traveler's saved onboarding interests, used as default context when the
   * prompt carries no signal of its own (FR-003). This is `PreferenceSet.vibes`
   * on the user profile — see data-model.md §1 for the naming map.
   */
  interests?: string[];
  source?: ChatPromptSource;
  /**
   * The clarifying question this message answers (feature 012).
   *
   * All three are optional so a client that has not been updated keeps working:
   * without them the message is ordinary prose and still reaches a correct plan
   * through conversation history — it just does not get the token saving the
   * fold provides. The mobile client ships inside an installed app, so a
   * traveler who has not updated must not break.
   */
  answersClarifyId?: string;
  /** The `value` of the option the traveler tapped. */
  answerValue?: string;
  /** The values that were offered, so the server can refuse one that was not. */
  answerOptions?: string[];
  /**
   * What the guide has already shown this traveler (feature 013), most recent
   * first and bounded.
   *
   * Optional, so an un-updated client is treated as having seen nothing —
   * identical to today's behaviour (FR-007).
   */
  seen?: ExposureEntry[];
  /** The entry introduced last turn, so an ignored one is not repeated (FR-013). */
  lastIntroduced?: string;
}

/** SSE event payloads streamed from POST /api/ai/chat. */
export interface ChatTokenEvent {
  delta: string;
}
/**
 * @deprecated Superseded by `ChatPlanEvent`. Kept only so conversations stored
 * before feature 004 still render; new replies emit a validated plan instead.
 */
export interface ChatRecommendationsEvent {
  items: Recommendation[];
}
/** The validated plan. Emitted only after every stop id passes validation. */
export interface ChatPlanEvent {
  plan: GeneratedPlan;
}
export interface ChatDoneEvent {
  conversationId: string;
  status: 'complete' | 'error';
}

/** GET /api/chat/prompts — curated suggestions for an empty chat (FR-008). */
export interface ChatPromptsResponse {
  /** At most 3, in the requested language only. */
  prompts: string[];
}

export interface EnrichRequest {
  text: string;
  language: Language;
}
export interface EnrichResponse {
  items: Recommendation[];
}

export interface EngagementRequest {
  listingId: string;
  type: EngagementType;
  /** The surface this came from (feature 018, FR-039). Never a person. */
  origin?: EngagementOrigin;
  /** Only on `promotion_view` / `promotion_click`. */
  dealId?: string;
}
export interface EngagementResponse {
  recorded: boolean;
}

export interface SpinResponse {
  place: Place | null;
  reason?: 'insufficient_data';
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}
