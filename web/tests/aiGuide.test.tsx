// The guide always has a way out (feature 007, T093 — FR-027).
//
// This project shipped the opposite once: the native app's guide hung on
// "Pensando…" forever because `fetch` REJECTS on a CORS failure rather than
// resolving with a bad status, and nothing caught the rejection — so neither
// `onDone` nor `onError` ever fired and the spinner had no terminating state.
//
// The mock CAPTURES the handlers and each test drives them, rather than firing
// them from inside the mock implementation. That mirrors reality — the server
// calls back later, not during the request — and keeps every assertion about
// the screen's reaction rather than about call timing.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@svtrip/core/i18n';

// A STABLE object, hoisted out of the factory. Returning a fresh `{ user: … }`
// on every call makes `user` a new identity each render, so any effect keyed on
// it re-runs forever — which hangs the whole suite rather than failing it. The
// real AuthProvider holds one object in state; the mock must too.
const authState = vi.hoisted(() => ({
  user: { uid: 'u1' },
  profile: null,
  loading: false,
}));
vi.mock('@svtrip/core/auth/AuthProvider', () => ({ useAuth: () => authState }));
vi.mock('@svtrip/core/repos/discoverRepo', () => ({ fetchPlaces: async () => [] }));
vi.mock('@svtrip/core/repos/useManagedBusinesses', () => ({
  useManagedBusinesses: () => ({ listings: [] }),
}));
// The guide persists turns and replays history through this repo, which reaches
// Firestore on import. Stubbed at the module boundary: what is under test is the
// screen's reaction to the stream, not durable storage.
vi.mock('@svtrip/core/repos/conversationRepo', () => ({
  persistTurn: async () => undefined,
  touchConversation: async () => undefined,
  subscribeToMessages: (_uid: string, _cid: string, cb: (m: unknown[]) => void) => {
    cb([]);
    return () => undefined;
  },
  // Calls back immediately with an empty list, like the real subscription. A
  // stub that never fires would leave the history rail spinning forever, and
  // that stray `role="status"` is indistinguishable from the guide's own
  // thinking indicator — which is what the spinner assertion below is about.
  subscribeToConversations: (_uid: string, cb: (c: unknown[]) => void) => {
    cb([]);
    return () => undefined;
  },
}));

interface Handlers {
  onToken: (delta: string) => void;
  onPlan: (plan: unknown) => void;
  onDone: (id: string, status: string) => void;
  onError: (message: string, code: string) => void;
}

// `vi.hoisted` because `vi.mock` factories are lifted above every other
// statement in the file: a plain `const` below would still be in its temporal
// dead zone when the factory runs.
const mocks = vi.hoisted(() => ({
  calls: [] as Array<{ req: { message: string }; handlers: unknown }>,
}));

vi.mock('@svtrip/core/apiClient', () => ({
  streamChat: (req: { message: string }, handlers: unknown) => {
    mocks.calls.push({ req, handlers });
    return Promise.resolve();
  },
}));

const { AIGuideScreen } = await import('../src/traveler/AIGuideScreen');

const latest = () => mocks.calls[mocks.calls.length - 1].handlers as Handlers;

function renderGuide() {
  return render(
    <MemoryRouter>
      <AIGuideScreen />
    </MemoryRouter>,
  );
}

function ask(text: string) {
  // The message box is the only placeholder on this screen: the guide renders
  // `DesktopLayout` without search props, so the nav's search input is absent.
  const input = screen.getByPlaceholderText(/./);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.submit(input.closest('form')!);
}

beforeEach(() => {
  mocks.calls.length = 0;
});
afterEach(cleanup);

describe('AI Guide — no state without a way out', () => {
  it('shows an error AND a retry when the request fails', async () => {
    renderGuide();
    ask('¿Qué hago este finde?');
    await waitFor(() => expect(mocks.calls.length).toBe(1));

    act(() => latest().onError('The guide is unavailable right now.', 'network_error'));

    // The failure is reported…
    expect(await screen.findByText('The guide is unavailable right now.')).toBeDefined();
    // …and there is something to do about it.
    expect(screen.getByRole('button', { name: /reintentar|retry/i })).toBeDefined();
  });

  it('stops the spinner when the stream drops mid-reply', async () => {
    renderGuide();
    ask('algo');
    await waitFor(() => expect(mocks.calls.length).toBe(1));

    // The dangerous case: tokens have arrived, so the UI is mid-render, and THEN
    // the connection dies. A half-written answer must not be left spinning.
    act(() => latest().onToken('Te recomiendo '));
    act(() => latest().onError('The guide is unavailable right now.', 'network_error'));

    await screen.findByText('The guide is unavailable right now.');
    // `role="status"` is the spinner's live region — it must be gone.
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('retrying re-sends the same prompt', async () => {
    renderGuide();
    ask('un plan de playa');
    await waitFor(() => expect(mocks.calls.length).toBe(1));
    act(() => latest().onError('nope', 'network_error'));

    fireEvent.click(await screen.findByRole('button', { name: /reintentar|retry/i }));

    await waitFor(() => expect(mocks.calls.length).toBe(2));
    expect(mocks.calls[1].req.message).toBe(mocks.calls[0].req.message);
  });

  it('renders a validated plan and never invents a stop name', async () => {
    renderGuide();
    ask('playa');
    await waitFor(() => expect(mocks.calls.length).toBe(1));

    act(() => {
      latest().onPlan({
        outcome: 'plan',
        intro: 'Te armé esto:',
        stops: [{ catalogId: 'el-tunco', order: 1, reason: 'Buen surf al atardecer.' }],
      });
      latest().onDone('conv-1', 'complete');
    });

    expect(await screen.findByText('Buen surf al atardecer.')).toBeDefined();
    // The catalog stub is empty, so the id itself is shown rather than a name
    // conjured from nowhere: a plan stop carries an id, and the guide may only
    // ever point at a place that really exists (feature 004).
    expect(screen.getByText('el-tunco')).toBeDefined();
  });
});
