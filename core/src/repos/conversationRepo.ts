// Durable chat memory (US2, FR-010). Conversations and their messages are owner-only tables
// (`conversations`, `messages`); the policies keep them private (feature 023 port of
// users/{uid}/conversations/**).
import type { Conversation, GeneratedPlan, Message } from '@svtrip/shared';
import { supabase } from '../supabase';
import { rowsOf, subscribeLive, userTopic } from '../db/live';
import { fromRow } from '@svtrip/shared';

export interface PersistTurnInput {
  uid: string;
  conversationId: string;
  userText: string;
  assistantText: string;
  /** The validated plan (feature 004). Replaces the old recommendations array. */
  plan: GeneratedPlan;
}

/** Persist a completed user+assistant turn and update conversation metadata. */
/**
 * Returns the ASSISTANT message's id (feature 016).
 *
 * Additive: every existing caller ignores the value and keeps working. The
 * desktop guide needs it because its turns live in component state until a
 * reload, and FR-041 ("the same reply cannot be kept twice") is answered by
 * `sourceMessageId` — which has to be the id this function just generated, not
 * a new one invented by the screen.
 */
export async function persistTurn(input: PersistTurnInput): Promise<string> {
  const { conversationId, userText, assistantText, plan } = input;
  // ONE database function, as it was one Firestore batch: both messages and the conversation's
  // metadata land together or not at all (supabase/migrations/*_functions_023.sql). The owner is
  // the session's, never `input.uid` — kept in the input type so no caller changes.
  const { data, error } = await supabase.rpc('persist_turn', {
    p_conversation_id: conversationId,
    p_user_text: userText,
    p_assistant_text: assistantText,
    p_plan: plan,
    p_recommendation_count: plan.stops.length,
    p_now_ms: Date.now(),
  });
  if (error) throw error;
  return data as string;
}

export async function touchConversation(_uid: string, conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('touch_conversation', { p_conversation_id: conversationId });
  if (error) throw error;
}

/**
 * Live subscription to this account's conversations, newest first.
 *
 * Added by feature 007: nothing listed conversations before, because the mobile
 * guide starts a fresh one on every mount and only ever subscribes to that one.
 * The desktop guide has room for a history rail, and FR-014 requires it show the
 * SAME account's conversations — one account, not two.
 *
 * `updatedAt` is written by `touchConversation` as a server timestamp, so a
 * document mid-write can briefly report it as null. Sorting client-side rather
 * than in the query keeps such a row in the list instead of dropping it out of
 * the ordering until the write lands.
 */
export function subscribeToConversations(
  uid: string,
  cb: (conversations: Conversation[]) => void,
  onError?: () => void,
): () => void {
  return subscribeLive(
    {
      table: 'conversations',
      topic: userTopic(uid),
      cacheKey: `conversations:${uid}`,
      read: async () =>
        rowsOf(await supabase.from('conversations').select('*').eq('profile_id', uid)).map((r) => {
          const c = fromRow<Conversation>('conversations', r);
          return { ...c, createdAt: millis(c.createdAt), updatedAt: millis(c.updatedAt) };
        }),
    },
    (rows) => cb(rows.sort((a, b) => b.updatedAt - a.updatedAt)),
    () => onError?.(),
  );
}

/**
 * Firestore hands back what it stored, and `serverTimestamp()` is stored as a
 * `Timestamp` object — never the `number` the `Conversation` type declares.
 * `d.data() as Conversation` only ASSERTED that; it never made it true, so
 * every reader downstream was handed an object while the compiler promised a
 * number.
 *
 * This surfaced as a blank page, not a type error. `Timestamp.valueOf()`
 * returns a sortable numeric string, so `updatedAt > 0` passed its guard and
 * the code went on to `new Date(theObject)` — Invalid Date — and
 * `Intl.DateTimeFormat.format()` threw `RangeError: Invalid time value`,
 * uncaught, taking the whole React tree down with it.
 *
 * The sort above was NOT broken by this, contrary to what the commit that
 * introduced this function claimed. Because `valueOf()` returns a numeric
 * string, `b.updatedAt - a.updatedAt` coerced both sides to numbers and
 * ordered correctly. The claim was written from reasoning; the regression test
 * then ran against the old code and the sort assertion passed, which is how the
 * mistake was caught. Left recorded here because a plausible wrong explanation
 * in a comment outlives the commit message that carried it.
 *
 * Messages do not need this — `persistTurn` writes their `createdAt` as a
 * plain `Date.now()`. Only the conversation document uses a server timestamp,
 * which is the right call there (it must not trust a client's clock for
 * ordering) and is precisely why the conversion belongs here.
 *
 * Returns 0 for a null mid-write value, matching the documented behaviour
 * above: the row stays in the list and simply renders without a date.
 */
function millis(value: unknown): number {
  if (typeof value === 'number') return value;
  const ts = value as { toMillis?: () => number } | null;
  return typeof ts?.toMillis === 'function' ? ts.toMillis() : 0;
}

/** Live subscription to a conversation's messages, ordered chronologically. */
export function subscribeToMessages(
  uid: string,
  cid: string,
  cb: (messages: Message[]) => void,
): () => void {
  return subscribeLive(
    {
      table: 'messages',
      topic: userTopic(uid),
      cacheKey: `messages:${uid}:${cid}`,
      read: async () =>
        rowsOf(await supabase.from('messages').select('*').eq('conversation_id', cid).order('created_at', { ascending: true }))
          .map((r) => fromRow<Message>('messages', r)),
    },
    cb,
  );
}
