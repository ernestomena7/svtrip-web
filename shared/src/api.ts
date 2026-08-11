// BFF HTTP contract types. Mirrors specs/.../contracts/bff-api.md.

import type {
  Language,
  Place,
  Recommendation,
  EngagementType,
  GeneratedPlan,
} from './types.js';

export interface ChatHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
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
