// Durable chat memory in Firestore (US2, FR-010). Conversations and their
// messages live under users/{uid} so security rules keep them private.
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import type { Conversation, GeneratedPlan, Message } from '@svtrip/shared';
import { db } from '../firebase';

function convosCol(uid: string) {
  return collection(db, 'users', uid, 'conversations');
}
function messagesCol(uid: string, cid: string) {
  return collection(db, 'users', uid, 'conversations', cid, 'messages');
}

export interface PersistTurnInput {
  uid: string;
  conversationId: string;
  userText: string;
  assistantText: string;
  /** The validated plan (feature 004). Replaces the old recommendations array. */
  plan: GeneratedPlan;
}

/** Persist a completed user+assistant turn and update conversation metadata. */
export async function persistTurn(input: PersistTurnInput): Promise<void> {
  const { uid, conversationId, userText, assistantText, plan } = input;
  const now = Date.now();
  const batch = writeBatch(db);

  const userMsgRef = doc(messagesCol(uid, conversationId));
  batch.set(userMsgRef, {
    messageId: userMsgRef.id,
    role: 'user',
    text: userText,
    createdAt: now,
    status: 'complete',
  });

  const aiMsgRef = doc(messagesCol(uid, conversationId));
  batch.set(aiMsgRef, {
    messageId: aiMsgRef.id,
    role: 'assistant',
    text: assistantText,
    createdAt: now + 1,
    plan,
    status: 'complete',
  });

  batch.set(
    doc(convosCol(uid), conversationId),
    {
      conversationId,
      title: userText.slice(0, 60),
      lastMessagePreview: assistantText.slice(0, 80),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      recommendationCount: plan.stops.length,
    },
    { merge: true },
  );

  await batch.commit();
}

export async function touchConversation(uid: string, conversationId: string): Promise<void> {
  await setDoc(
    doc(convosCol(uid), conversationId),
    { conversationId, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
    { merge: true },
  );
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
  return onSnapshot(
    convosCol(uid),
    (snap) => {
      const rows = snap.docs.map((d) => d.data() as Conversation);
      cb(rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)));
    },
    () => onError?.(),
  );
}

/** Live subscription to a conversation's messages, ordered chronologically. */
export function subscribeToMessages(
  uid: string,
  cid: string,
  cb: (messages: Message[]) => void,
): () => void {
  const q = query(messagesCol(uid, cid), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as Message));
  });
}
