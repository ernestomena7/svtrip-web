// The AI Guide on a wide screen (feature 007, T088–T092 — FR-026, FR-027).
//
// The whole reason this story is separate from Discover: the guide's mobile
// interaction model is a full-height chat column, and that is the one layout
// that translates *worst* to a desktop. On a phone the plan scrolls away above
// the reply and you scroll back for it. On a 1440px screen there is room to keep
// both, so the conversation lives on the left and the plan stays parked on the
// right where it can be read while the answer is still arriving.
//
// FR-027 is the hard requirement here, and it is the constitution's "no state
// without a way out" applied to the one screen that streams: a failed or dropped
// request must surface an error AND a retry. Never an indefinite spinner. This
// project already shipped that bug once — the native app hung on "Pensando…"
// forever because `fetch` rejects on a CORS failure and nothing caught it.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { GeneratedPlan, Message, Place } from '@svtrip/shared';
import { resolveLocalized } from '@svtrip/shared';
import { fetchPlaces } from '@svtrip/core/repos/discoverRepo';
import { streamChat } from '@svtrip/core/apiClient';
import {
  persistTurn,
  subscribeToMessages,
  touchConversation,
} from '@svtrip/core/repos/conversationRepo';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useUiStore } from '@svtrip/core/uiStore';
import { Icon } from '@svtrip/core/Icon';
import { Button, Card, EmptyState, TextInput, cx } from '../components/ui';
import { ConversationHistory } from './ConversationHistory';
import { DesktopLayout } from '../shell/DesktopLayout';

interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

export function AIGuideScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const language = useUiStore((s) => s.language);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [live, setLive] = useState<string | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  // A real id from the first render, not once the server answers: turns are
  // persisted under it, and a conversation that only gets an id on success would
  // lose the user's very first message whenever that request failed.
  const [conversationId, setConversationId] = useState<string>(() => crypto.randomUUID());
  const [catalog, setCatalog] = useState<Place[]>([]);
  const lastPrompt = useRef<string>('');
  // Held in a ref as well as state: `onDone` fires in the same tick as the last
  // `onPlan`, so reading the state there would persist the previous turn's plan.
  const planRef = useRef<GeneratedPlan | null>(null);

  // A plan stop carries a catalog id and nothing else — feature 004's guarantee
  // that the guide can only ever point at a place that really exists. The name
  // is therefore ours to resolve, not the model's to supply.
  useEffect(() => {
    let cancelled = false;
    fetchPlaces()
      .then((p) => !cancelled && setCatalog(p))
      .catch(() => {
        /* A plan still renders with ids and reasons; names are the enhancement. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reopening a past conversation replays it from Firestore — the same
  // documents the phone wrote (FR-014).
  useEffect(() => {
    if (!user) return;
    return subscribeToMessages(user.uid, conversationId, (messages: Message[]) => {
      const replayed = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text }));
      // Only adopt the stored history when there is some; an empty result is a
      // brand-new conversation and must not wipe a turn already on screen.
      if (replayed.length > 0) setTurns(replayed);
    });
  }, [user, conversationId]);

  const nameFor = (catalogId: string): string => {
    const place = catalog.find((p) => p.placeId === catalogId);
    return place ? resolveLocalized(place.name, place.nameI18n, language) : catalogId;
  };
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Optional-called: `scrollIntoView` is a nicety, and it is absent in some
    // environments (jsdom, older embedded webviews). Calling it unguarded means
    // a missing convenience takes the entire conversation down with it.
    bottom.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [turns.length, live]);

  function ask(prompt: string) {
    const text = prompt.trim();
    if (!text || busy) return;
    lastPrompt.current = text;
    setTurns((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLive('');
    setError(null);
    setBusy(true);

    let buffer = '';
    void streamChat(
      { message: text, conversationId: conversationId ?? null, language },
      {
        onToken: (delta) => {
          buffer += delta;
          setLive(buffer);
        },
        onPlan: (received) => {
          planRef.current = received;
          setPlan(received);
        },
        onDone: (id, status) => {
          if (id) setConversationId(id);
          setTurns((prev) => [...prev, { role: 'assistant', text: buffer }]);
          setLive(null);
          setBusy(false);
          if (status === 'error') {
            setError(t('guide.error'));
            return;
          }
          // Durable memory, written to the SAME documents the mobile app writes
          // (FR-014). Only when a plan came back — matching the mobile guide,
          // which persists a turn only on `complete` WITH a plan. Synthesising a
          // placeholder outcome here would put a shape in Firestore that no
          // reader expects.
          //
          // Fire-and-forget on purpose: a failed write must not take away the
          // answer already on screen.
          if (user && planRef.current) {
            const cid = id || conversationId;
            void touchConversation(user.uid, cid);
            void persistTurn({
              uid: user.uid,
              conversationId: cid,
              userText: text,
              assistantText: buffer,
              plan: planRef.current,
            }).catch(() => {
              /* The conversation still works; only its history is missing. */
            });
          }
        },
        onError: (message) => {
          // The way out. Without this branch the spinner below never stops.
          setLive(null);
          setBusy(false);
          setError(message || t('guide.error'));
        },
      },
    );
  }

  const greeting = turns.length === 0 && !live && !error;

  return (
    <DesktopLayout>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* ── Conversation ─────────────────────────────────────────────── */}
        <div className="flex min-h-[60vh] flex-col">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text md:text-3xl">
              {t('nav.guide')}
            </h1>
            {(turns.length > 0 || plan) && (
              <Button
                variant="ghost"
                iconLeft="plus"
                onClick={() => {
                  setTurns([]);
                  setPlan(null);
                  setError(null);
                  planRef.current = null;
                  setConversationId(crypto.randomUUID());
                }}
              >
                {t('guide.newChat')}
              </Button>
            )}
          </div>

          <div className="mt-6 flex-1 space-y-4">
            {greeting && (
              <EmptyState icon="sparkles" title={t('guide.greeting')} body={t('guide.suggestions.title', '')} />
            )}

            {turns.map((turn, i) => (
              <div
                key={i}
                className={cx('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cx(
                    'max-w-[80%] whitespace-pre-wrap rounded-lg px-4 py-3 text-[15px] leading-relaxed',
                    turn.role === 'user'
                      ? 'bg-sunset text-white shadow-red'
                      : 'bg-surface text-text shadow-md',
                  )}
                >
                  {turn.text}
                </div>
              </div>
            ))}

            {live !== null && (
              <div className="flex justify-start">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-surface px-4 py-3 text-[15px] leading-relaxed text-text shadow-md">
                  {live || (
                    <span className="inline-flex items-center gap-2 text-muted">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                      {t('guide.thinking')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* FR-027: an error is never the end of the road. */}
            {error && (
              <Card className="flex flex-wrap items-center gap-3 p-4" role="alert">
                <span className="text-primary">
                  <Icon name="bell" size={18} />
                </span>
                <span className="text-sm font-bold text-text">{error}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-auto"
                  onClick={() => ask(lastPrompt.current)}
                >
                  {t('guide.retry')}
                </Button>
              </Card>
            )}

            <div ref={bottom} />
          </div>

          <form
            className="mt-6 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <TextInput
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('guide.placeholder')}
              disabled={!user}
            />
            <Button type="submit" iconLeft="send" disabled={busy || !input.trim()}>
              {t('guide.send')}
            </Button>
          </form>
        </div>

        {/* ── The plan, kept in view ───────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {plan ? (
            <Card className="space-y-4 p-6">
              <h2 className="font-display text-lg font-extrabold text-text">{t('guide.plan')}</h2>
              {plan.intro && <p className="text-sm leading-relaxed text-muted">{plan.intro}</p>}
              <ol className="space-y-3">
                {plan.stops.map((stop) => (
                  <li key={`${stop.catalogId}-${stop.order}`}>
                    <button
                      type="button"
                      onClick={() => navigate(`/place/${stop.catalogId}`)}
                      className="w-full rounded-md bg-surface-2 p-3 text-left transition hover:brightness-95"
                    >
                      <p className="font-display text-sm font-extrabold text-text">{nameFor(stop.catalogId)}</p>
                      {stop.reason && <p className="mt-1 text-xs text-muted">{stop.reason}</p>}
                    </button>
                  </li>
                ))}
              </ol>
              {plan.clarifyingQuestion && (
                <p className="text-sm text-muted">{plan.clarifyingQuestion}</p>
              )}
            </Card>
          ) : (
            <Card className="p-6">
              <p className="text-sm text-muted">{t('guide.plan')}</p>
            </Card>
          )}

          <ConversationHistory
            activeId={conversationId}
            onSelect={(id) => {
              setTurns([]);
              setPlan(null);
              setError(null);
              planRef.current = null;
              setConversationId(id);
            }}
          />
        </aside>
      </div>
    </DesktopLayout>
  );
}
