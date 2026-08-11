// Typed BFF client. Attaches the Firebase ID token and exposes an SSE reader for
// the streaming chat endpoint.
import type {
  ChatRequest,
  ChatPromptsResponse,
  EnrichRequest,
  EnrichResponse,
  EngagementRequest,
  EngagementResponse,
  GeneratedPlan,
  Language,
  Recommendation,
  SpinResponse,
} from '@svtrip/shared';
import { auth } from './firebase';

const BASE = import.meta.env.VITE_BFF_BASE_URL ?? '/api';

async function authHeader(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText, code: 'error' }));
    throw Object.assign(new Error(err.error ?? 'Request failed'), { code: err.code, status: res.status });
  }
  return res.json() as Promise<T>;
}

/** GET with the same auth + error normalization as postJson. */
export async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { ...(await authHeader()) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText, code: 'error' }));
    throw Object.assign(new Error(err.error ?? 'Request failed'), {
      code: err.code,
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

/** DELETE with the same auth + error normalization as postJson. */
export async function deleteJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { ...(await authHeader()) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText, code: 'error' }));
    throw Object.assign(new Error(err.error ?? 'Request failed'), {
      code: err.code,
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

export interface ChatStreamHandlers {
  onToken: (delta: string) => void;
  /** The validated plan (feature 004). Fires once, after every stop id resolved. */
  onPlan: (plan: GeneratedPlan) => void;
  /** @deprecated Legacy pre-004 event; retained so older servers still render. */
  onRecommendations?: (items: Recommendation[]) => void;
  onDone: (conversationId: string, status: 'complete' | 'error') => void;
  onError: (message: string, code: string) => void;
}

/** Streams POST /api/ai/chat, parsing the SSE event frames. */
export async function streamChat(req: ChatRequest, handlers: ChatStreamHandlers): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(req),
    });
  } catch {
    // `fetch` REJECTS (rather than resolving with a bad status) on a network-
    // level failure — CORS blocked, DNS failure, offline mid-request. Uncaught,
    // this left the caller's "Pensando…" spinner running forever: nothing ever
    // called onError or onDone. Discovered on a native build where the app's
    // origin wasn't yet allowed by the BFF's CORS policy — the fix there was
    // the origin, but a network failure must never hang the UI regardless of
    // its cause (Constitution V: no state without a way out).
    handlers.onError('The guide is unavailable right now.', 'network_error');
    return;
  }
  if (!res.ok || !res.body) {
    handlers.onError('The guide is unavailable right now.', `http_${res.status}`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (frame: string) => {
    const lines = frame.split('\n');
    let event = 'message';
    let data = '';
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    const payload = JSON.parse(data);
    if (event === 'token') handlers.onToken(payload.delta);
    else if (event === 'plan') handlers.onPlan(payload.plan);
    else if (event === 'recommendations') handlers.onRecommendations?.(payload.items);
    else if (event === 'error') handlers.onError(payload.error, payload.code);
    else if (event === 'done') handlers.onDone(payload.conversationId, payload.status);
  };

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (frame.trim()) dispatch(frame);
      }
    }
  } catch {
    // The connection can drop mid-stream after headers already arrived fine —
    // same failure class as the initial fetch, same fix: surface it rather than
    // leaving the caller's pending state with no way out.
    handlers.onError('The guide is unavailable right now.', 'network_error');
  }
}

/**
 * Curated suggestions for an empty chat (FR-008). Never throws: the caller falls
 * back to bundled defaults so the suggestion area is never empty offline.
 */
export async function fetchSuggestedPrompts(language: Language): Promise<string[] | null> {
  try {
    const res = await fetch(`${BASE}/chat/prompts?language=${language}`, {
      headers: { ...(await authHeader()) },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ChatPromptsResponse;
    return Array.isArray(data.prompts) ? data.prompts.slice(0, 3) : null;
  } catch {
    return null;
  }
}

export function enrich(req: EnrichRequest): Promise<EnrichResponse> {
  return postJson<EnrichResponse>('/ai/enrich', req);
}

export function recordEngagement(req: EngagementRequest): Promise<EngagementResponse> {
  return postJson<EngagementResponse>('/engagement', req);
}

export async function spin(mood?: string): Promise<SpinResponse> {
  const res = await fetch(`${BASE}/spin${mood ? `?mood=${encodeURIComponent(mood)}` : ''}`, {
    headers: { ...(await authHeader()) },
  });
  return res.json() as Promise<SpinResponse>;
}
