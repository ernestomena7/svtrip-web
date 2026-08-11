// Regression test for a real bug found on a native build (2026-08-06): a
// network-level failure — CORS blocked, offline, DNS — makes `fetch` REJECT
// rather than resolve with a bad status. Uncaught, that left the AI Guide's
// "Pensando…" spinner running forever: nothing ever called onError or onDone.
// The fix is a try/catch around both the request and the stream read; these
// tests pin that neither failure point can hang the caller again.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/firebase', () => ({ auth: { currentUser: null } }));

const { streamChat } = await import('../src/apiClient');

function baseHandlers() {
  return {
    onToken: vi.fn(),
    onPlan: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };
}

const req = {
  conversationId: 'c1',
  message: 'hola',
  language: 'es' as const,
  history: [],
  interests: [],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('streamChat — network failure before any response', () => {
  it('calls onError instead of hanging when fetch rejects (CORS, offline, DNS)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    const handlers = baseHandlers();

    await streamChat(req, handlers);

    expect(handlers.onError).toHaveBeenCalledWith(expect.any(String), 'network_error');
    expect(handlers.onDone).not.toHaveBeenCalled();
  });
});

describe('streamChat — connection drops mid-stream', () => {
  it('calls onError when the reader rejects after headers already arrived', async () => {
    const reader = {
      read: vi.fn().mockRejectedValue(new Error('network changed')),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      }),
    );
    const handlers = baseHandlers();

    await streamChat(req, handlers);

    expect(handlers.onError).toHaveBeenCalledWith(expect.any(String), 'network_error');
  });
});

describe('streamChat — the happy path still works', () => {
  it('dispatches token and done frames from a normal SSE stream', async () => {
    const encoder = new TextEncoder();
    const frames = [
      'event: token\ndata: {"delta":"Hola"}\n\n',
      'event: done\ndata: {"conversationId":"c1","status":"complete"}\n\n',
    ].join('');
    const chunks = [encoder.encode(frames)];
    let i = 0;
    const reader = {
      read: vi.fn().mockImplementation(async () => {
        if (i < chunks.length) return { done: false, value: chunks[i++] };
        return { done: true, value: undefined };
      }),
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => reader },
      }),
    );
    const handlers = baseHandlers();

    await streamChat(req, handlers);

    expect(handlers.onToken).toHaveBeenCalledWith('Hola');
    expect(handlers.onDone).toHaveBeenCalledWith('c1', 'complete');
    expect(handlers.onError).not.toHaveBeenCalled();
  });
});
