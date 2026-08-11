// The showcase degrades to absent, never to broken (feature 007 — FR-009a).
//
// Every other screen in SVTrip must show a meaningful error state; this one is
// the documented exception, and these tests are what make that a decision rather
// than an oversight. A first-time visitor who arrives while the catalog is down
// should read about the product and click through — not stare at a row of
// skeletons or a "could not load" box that tells them nothing they can act on.
//
// Also guards the two things the showcase must never compute for itself: the
// cover image and the rating. Both arrive already decided from the server, so a
// card here cannot disagree with the same place's profile (FR-021, FR-022).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@svtrip/core/i18n';
import { Showcase } from '../src/sections/Showcase';

const PLACES = [
  {
    placeId: 'el-barrilon',
    name: 'El Barrilón',
    description: 'Mariscos.',
    coverImage: 'https://example.test/barrilon.jpg',
    moods: ['food'],
    score: { kind: 'average', value: 4.6, count: 12 },
  },
  {
    placeId: 'sin-foto',
    name: 'Lugar sin foto',
    description: 'Sin imagen.',
    moods: ['hiking'],
    score: { kind: 'none' },
  },
];

function stubFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

beforeEach(() => vi.unstubAllGlobals());
// Explicit, because this workspace runs vitest with `globals: false`, which
// disables Testing Library's automatic cleanup — without it each test inherits
// the previous test's DOM and text queries start matching two nodes.
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Showcase', () => {
  it('renders nothing at all when the endpoint fails', async () => {
    stubFetch(() => Promise.reject(new Error('network down')));
    const { container } = render(<Showcase />);
    // Not "renders an error" — renders NOTHING. The section disappears and the
    // rest of the page carries the message on its own (FR-009a).
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('renders nothing when the endpoint answers with an error status', async () => {
    stubFetch(() => Promise.resolve({ ok: false, status: 503 } as Response));
    const { container } = render(<Showcase />);
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('renders nothing when the catalog is empty rather than an empty grid', async () => {
    stubFetch(() => Promise.resolve({ ok: true, json: async () => ({ places: [] }) } as Response));
    const { container } = render(<Showcase />);
    await waitFor(() => expect(container.innerHTML).toBe(''));
  });

  it('renders the places the server sent', async () => {
    stubFetch(() =>
      Promise.resolve({ ok: true, json: async () => ({ places: PLACES }) } as Response),
    );
    render(<Showcase />);
    expect(await screen.findByText('El Barrilón')).toBeDefined();
    expect(await screen.findByText('Lugar sin foto')).toBeDefined();
  });

  it('uses the cover image the server resolved, and the gradient when there is none', async () => {
    stubFetch(() =>
      Promise.resolve({ ok: true, json: async () => ({ places: PLACES }) } as Response),
    );
    const { container } = render(<Showcase />);
    await screen.findByText('El Barrilón');
    const images = container.querySelectorAll('img');
    // Exactly one card has a photo; the other falls back to the brand gradient,
    // which is what "no photo" is supposed to look like — not a broken image.
    expect(images.length).toBe(1);
    expect(images[0].getAttribute('src')).toBe('https://example.test/barrilon.jpg');
  });

  it('renders the score signal it was given and nothing when there is none', async () => {
    stubFetch(() =>
      Promise.resolve({ ok: true, json: async () => ({ places: PLACES }) } as Response),
    );
    render(<Showcase />);
    // A real average, formatted from the signal — never computed here.
    expect(await screen.findByText('4.6')).toBeDefined();
    expect(await screen.findByText('(12)')).toBeDefined();
    // `kind: 'none'` means show no score at all, not "0.0" and not a placeholder.
    expect(screen.queryByText('0.0')).toBeNull();
  });
});
