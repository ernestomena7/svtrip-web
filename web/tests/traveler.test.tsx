// Desktop app contracts (feature 007, T086).
//
// Scoped to the things that would be *wrong* rather than merely ugly: the two
// single-decision functions this interface must consume instead of reimplement,
// and the signed-out boundary. Constitution III mandates security and contract
// tests, not exhaustive UI coverage.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { coverImage, scoreSignalFor } from '@svtrip/shared';
import '@svtrip/core/i18n';
import { ScoreBadge } from '../src/components/ScoreBadge';
import { ActivityCard } from '../src/components/ActivityCard';

// This workspace runs vitest with `globals: false`, so Testing Library's
// automatic cleanup is off and each test would inherit the previous DOM.
afterEach(cleanup);
beforeEach(() => vi.unstubAllGlobals());

describe('ScoreBadge — one scoring decision, drawn not computed (SC-009)', () => {
  it('shows a real average with its count', () => {
    render(<ScoreBadge signal={{ kind: 'average', value: 4.6, count: 12 }} />);
    expect(screen.getByText('4.6')).toBeDefined();
    expect(screen.getByText('(12)')).toBeDefined();
  });

  it('renders NOTHING when there is no score', () => {
    // Not "0.0", not a dash, not an empty star row. A place with no reviews has
    // no rating, and implying otherwise is the failure feature 005 fixed.
    const { container } = render(<ScoreBadge signal={{ kind: 'none' }} />);
    expect(container.innerHTML).toBe('');
  });

  it('keeps an editorial rating out of the average slot', () => {
    render(<ScoreBadge signal={{ kind: 'editorial' }} />);
    // A labelled badge, never a number that could pass for a traveler average.
    expect(screen.queryByText(/^\d\.\d$/)).toBeNull();
  });
});

describe('ActivityCard — takes decisions, does not make them', () => {
  it('renders the image it is given', () => {
    const { container } = render(<ActivityCard image="https://example.test/a.jpg" title="A" />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://example.test/a.jpg');
  });

  it('falls back to the brand gradient rather than a broken image', () => {
    // 18 of 19 catalog entries have no photo, so this is the common case. An
    // <img src=""> here would render a broken-image icon on most of the catalog.
    const { container } = render(<ActivityCard title="Sin foto" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.bg-sunset')).not.toBeNull();
  });

  it('shows the score signal it is handed, and none when there is none', () => {
    const { rerender, container } = render(
      <ActivityCard title="A" score={{ kind: 'average', value: 4.2, count: 3 }} />,
    );
    expect(screen.getByText('4.2')).toBeDefined();
    rerender(<ActivityCard title="A" score={{ kind: 'none' }} />);
    expect(container.textContent).not.toContain('0.0');
  });
});

describe('the shared decisions are the same ones the server used', () => {
  it('coverImage prefers the banner, exactly as the endpoint does', () => {
    // The card and the public endpoint must agree about which image represents
    // a place, or the preview and the profile show different photos (FR-021).
    expect(coverImage({ bannerURL: 'b.jpg', photos: ['p.jpg'] })).toBe('b.jpg');
    expect(coverImage({ photos: ['p.jpg'] })).toBe('p.jpg');
    expect(coverImage({})).toBeUndefined();
  });

  it('scoreSignalFor never invents an average from an editorial rating', () => {
    expect(scoreSignalFor({ rating: 4.8, source: 'seed' })).toEqual({ kind: 'editorial' });
    expect(scoreSignalFor({ ratingAvg: 4.6, ratingCount: 12, source: 'listing' })).toEqual({
      kind: 'average',
      value: 4.6,
      count: 12,
    });
    expect(scoreSignalFor({ source: 'listing' })).toEqual({ kind: 'none' });
  });
});

describe('the signed-out boundary', () => {
  it('refuses an absolute URL as a post-sign-in destination', async () => {
    // Guards against turning sign-in into an open redirect: a phishing link
    // could otherwise point `?next=` at its own domain and borrow SVTrip's
    // sign-in screen to get there.
    const { useReturnTo } = await import('../src/app/useReturnTo');

    function Probe() {
      return <span data-testid="next">{String(useReturnTo())}</span>;
    }

    for (const [search, expected] of [
      ['?next=%2Fplace%2Fel-tunco', '/place/el-tunco'],
      ['?next=https%3A%2F%2Fevil.example', 'null'],
      ['?next=%2F%2Fevil.example', 'null'],
      ['', 'null'],
    ] as const) {
      cleanup();
      render(
        <MemoryRouter initialEntries={[`/sign-in${search}`]}>
          <Probe />
        </MemoryRouter>,
      );
      expect(screen.getByTestId('next').textContent, search || '(no query)').toBe(expected);
    }
  });
});
