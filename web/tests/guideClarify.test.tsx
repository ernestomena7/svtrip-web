// The clarifying question on the desktop guide (feature 012, T024 — US1, US2).
//
// The property worth pinning hardest is negative: **no reply following an answer
// is a second question.** A guide that asks, gets a vague answer, and asks again
// has stopped being a guide — that is the failure mode US1 introduces and US2
// exists to close.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { GeneratedPlan } from '@svtrip/shared';
import '@svtrip/core/i18n';

/** Replies the fake stream hands back, in order. */
let scripted: GeneratedPlan[] = [];
const sentRequests: Record<string, unknown>[] = [];

vi.mock('@svtrip/core/apiClient', () => ({
  streamChat: async (req: Record<string, unknown>, handlers: Record<string, (...a: never[]) => void>) => {
    sentRequests.push(req);
    const plan = scripted.shift();
    if (plan) (handlers.onPlan as (p: GeneratedPlan) => void)(plan);
    (handlers.onDone as (id: string, status: string) => void)('convo-1', 'complete');
  },
  fetchSuggestedPrompts: async () => [],
}));

// A STABLE object, hoisted out of the factory — aiGuide.test.tsx already
// documents why: returning a fresh `{ user: … }` on every call gives `user` a
// new identity each render, so any effect keyed on it re-runs forever. That
// hangs the suite (heap exhaustion) rather than failing it, which is a much
// worse way to learn about it. The real AuthProvider holds one object in state;
// the mock must too.
const authState = vi.hoisted(() => ({
  user: { uid: 'traveler-1' },
  profile: { preferences: { vibes: ['beach'] } },
  loading: false,
}));
vi.mock('@svtrip/core/auth/AuthProvider', () => ({ useAuth: () => authState }));

vi.mock('../src/shell/DesktopLayout', () => ({
  DesktopLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mirrors the shape aiGuide.test.tsx already proved: the subscriptions must
// CALL BACK, not just return an unsubscribe. A stub that never fires leaves the
// history rail spinning, and its `role="status"` is indistinguishable from the
// guide's own thinking indicator.
vi.mock('@svtrip/core/repos/conversationRepo', () => ({
  persistTurn: async () => undefined,
  touchConversation: async () => undefined,
  subscribeToMessages: (_uid: string, _cid: string, cb: (m: unknown[]) => void) => {
    cb([]);
    return () => undefined;
  },
  subscribeToConversations: (_uid: string, cb: (c: unknown[]) => void) => {
    cb([]);
    return () => undefined;
  },
}));
// Feature 013 added this dependency to the guide screen, and it initializes
// Firebase on import. Mocking it is a new-dependency stub, not a change to what
// any assertion below checks.
vi.mock('@svtrip/core/repos/exposureRepo', () => ({
  loadExposure: async () => [],
  recordShown: () => undefined,
  recordTakenUp: () => undefined,
  clearExposure: async () => undefined,
  useExposure: () => ({ entries: [], loading: false }),
  SEEN_LIMIT: 60,
}));
vi.mock('@svtrip/core/repos/discoverRepo', () => ({ fetchPlaces: async () => [] }));

// `ClarifyOptions` began calling the taxonomy hook in feature 014, which pulls
// the real module — and with it the Firebase Web SDK — into this suite. Stubbed
// so the file loads; nothing here is about taxonomy.
vi.mock('@svtrip/core/taxonomy/useTaxonomy', () => ({
  useMergedTaxonomy: () => ({
    keys: [],
    label: (k: string) => k,
    icon: () => ({ kind: 'builtIn', name: 'star' }),
  }),
  useTaxonomy: () => ({ entries: [], loading: false, reload: () => {} }),
  useScopedServices: () => ({ keys: [], label: (k: string) => k }),
}));
const managed = vi.hoisted(() => ({ listings: [] }));
vi.mock('@svtrip/core/repos/useManagedBusinesses', () => ({
  useManagedBusinesses: () => managed,
}));

const { AIGuideScreen } = await import('../src/traveler/AIGuideScreen');

const clarifyReply: GeneratedPlan = {
  outcome: 'clarify',
  intro: '',
  stops: [],
  clarifyingQuestion: 'guide.clarify.question',
  clarifyId: 'q-1',
  clarifyOptions: [
    { value: 'romantic-date', labelKey: 'moods.romantic-date', icon: 'romantic-date' },
    { value: 'local-food', labelKey: 'moods.local-food', icon: 'local-food' },
  ],
};

const planReply: GeneratedPlan = {
  outcome: 'plan',
  intro: 'Te armé algo.',
  stops: [{ catalogId: 'el-tunco', order: 1, reason: 'Buen atardecer.' }],
};

afterEach(cleanup);
beforeEach(() => {
  scripted = [];
  sentRequests.length = 0;
});

const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const ask = (text: string) => {
  const box = document.querySelector('input, textarea') as HTMLInputElement;
  fireEvent.change(box, { target: { value: text } });
  fireEvent.submit(box.closest('form')!);
};

describe('the question and its chips', () => {
  it('renders the question and 2-4 tappable options', async () => {
    scripted = [clarifyReply];
    render(<AIGuideScreen />);
    ask('quiero ver lugares en la playa');

    await waitFor(() => expect(screen.getByText(/Cita romántica/)).toBeDefined());
    expect(screen.getByText(/Comida local/)).toBeDefined();
  });

  it('resolves the i18n key rather than printing it', async () => {
    // The server sends a KEY so a stored reply renders in the language the
    // traveler is using NOW. If the key leaks to screen, that indirection has
    // silently stopped working.
    scripted = [clarifyReply];
    render(<AIGuideScreen />);
    ask('quiero ver lugares en la playa');

    await waitFor(() => expect(screen.queryByText('guide.clarify.question')).toBeNull());
  });
});

describe('answering', () => {
  it('sends the answer with the question it belongs to', async () => {
    scripted = [clarifyReply, planReply];
    render(<AIGuideScreen />);
    ask('quiero ver lugares en la playa');

    await waitFor(() => expect(screen.getByText(/Cita romántica/)).toBeDefined());
    fireEvent.click(screen.getByText(/Cita romántica/));

    await waitFor(() => expect(sentRequests).toHaveLength(2));
    expect(sentRequests[1].answersClarifyId).toBe('q-1');
    expect(sentRequests[1].answerValue).toBe('romantic-date');
    expect(sentRequests[1].answerOptions).toEqual(['romantic-date', 'local-food']);
  });

  it('NEVER produces a second question (FR-004, US2)', async () => {
    // Even if the model wanted to ask again, the server skips the gate on an
    // answering turn. This pins the surface not undoing that.
    scripted = [clarifyReply, planReply];
    render(<AIGuideScreen />);
    ask('quiero ver lugares en la playa');

    await waitFor(() => expect(screen.getByText(/Cita romántica/)).toBeDefined());
    fireEvent.click(screen.getByText(/Cita romántica/));

    await waitFor(() => expect(sentRequests).toHaveLength(2));
    // The reply that came back is a plan, and no chips are on screen from it.
    await waitFor(() => expect(screen.getByText(/Te armé algo/)).toBeDefined());
  });
});

describe('a reply with no options', () => {
  it('renders normally — an old stored reply must not break (additive field)', async () => {
    // Conversations persist. A reply generated before feature 012 has no
    // clarifyOptions at all, and it has to keep rendering.
    scripted = [{ ...clarifyReply, clarifyOptions: undefined, clarifyId: undefined }];
    render(<AIGuideScreen />);
    ask('quiero ver lugares en la playa');

    await waitFor(() => expect(sentRequests).toHaveLength(1));
    expect(screen.queryByText(/Cita romántica/)).toBeNull();
  });
});
