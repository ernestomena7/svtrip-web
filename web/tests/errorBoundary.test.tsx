// Containment of render-time errors (added after the /guide blank-page bug).
//
// The bug itself is pinned in core/tests/conversationRepo.test.ts. What THIS
// file pins is the property that made that bug so expensive: an error thrown
// anywhere in the tree unmounted everything, so a bad date on one row of a side
// panel cost the entire screen.
//
// The assertion that matters is not "a fallback appears" — it is that the
// SIBLINGS survive. A boundary that renders a nice message while still losing
// the rest of the page has not solved the problem it exists for.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@svtrip/core/i18n';
import { CrashNotice, ErrorBoundary } from '../src/components/ErrorBoundary';

afterEach(cleanup);

function Explodes(): JSX.Element {
  throw new Error('Invalid time value');
}

/**
 * React logs caught errors to console.error regardless of the boundary, which
 * is noise here, not signal — the test asserts behaviour, and the logging is
 * asserted explicitly in its own case below.
 */
function renderQuietly(ui: Parameters<typeof render>[0]) {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const result = render(ui);
  return { ...result, spy };
}

describe('ErrorBoundary', () => {
  it('keeps siblings on screen when one subtree throws', () => {
    const { spy } = renderQuietly(
      <div>
        <p>la conversación</p>
        <ErrorBoundary fallback={null}>
          <Explodes />
        </ErrorBoundary>
        <p>el plan</p>
      </div>,
    );

    // The whole point: before this existed, a throw here left an empty page.
    expect(screen.getByText('la conversación')).toBeDefined();
    expect(screen.getByText('el plan')).toBeDefined();
    spy.mockRestore();
  });

  it('renders nothing when the fallback is null, for a region better absent', () => {
    const { container, spy } = renderQuietly(
      <ErrorBoundary fallback={null}>
        <Explodes />
      </ErrorBoundary>,
    );

    expect(container.textContent).toBe('');
    spy.mockRestore();
  });

  it('renders a localized notice with CrashNotice, never raw English', () => {
    const { spy } = renderQuietly(
      <ErrorBoundary fallback={<CrashNotice />}>
        <Explodes />
      </ErrorBoundary>,
    );

    // Spanish is the product's primary language (Principle VI); a boundary that
    // fell back to an untranslated string would be a second failure on top of
    // the one it caught.
    expect(screen.getByText('Esta sección no cargó')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeDefined();
    spy.mockRestore();
  });

  it('logs the failure with its label, since the UI deliberately does not name it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary label="ConversationHistory" fallback={null}>
        <Explodes />
      </ErrorBoundary>,
    );

    // Without this, a region that fails silently to null is invisible to
    // whoever has to debug it — which is the failure mode this boundary would
    // otherwise introduce while fixing another.
    const logged = spy.mock.calls.some((args) =>
      args.some((a) => typeof a === 'string' && a.includes('ConversationHistory')),
    );
    expect(logged).toBe(true);
    spy.mockRestore();
  });

  it('renders children untouched when nothing throws', () => {
    render(
      <ErrorBoundary fallback={<CrashNotice />}>
        <p>todo bien</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('todo bien')).toBeDefined();
  });
});
