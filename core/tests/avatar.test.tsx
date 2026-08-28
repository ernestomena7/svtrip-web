// @vitest-environment jsdom
//
// The only DOM test in this workspace: everything else in core/tests is pure
// logic. Scoped with the pragma rather than switching the whole workspace, so a
// logic test does not pay for a jsdom boot it never uses.
// The avatar fallback, including the case the old one could not see.
//
// Every avatar in the product used to be `photoURL ? <img/> : <initial/>`. That
// falls back when the URL is ABSENT, and the reviews on a place profile were
// showing a broken-image icon anyway — because a Google profile photo is
// PRESENT and unloadable:
//
//   `lh3.googleusercontent.com` serves those images without the CORS headers
//   Chrome requires for a cross-origin subresource, so the browser blocks the
//   response (`net::ERR_BLOCKED_BY_ORB`). Verified at the time: `curl` returned
//   200 and a 10 KB PNG, while in the page the element reported
//   `complete: true, naturalWidth: 0`.
//
// So the two tests that matter are the failure ones. The absence case worked all
// along and is here only to keep it working.
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Avatar } from '../src/Avatar';

afterEach(cleanup);

const img = () => document.querySelector('img');
const icon = () => document.querySelector('svg');

describe('when there is no photo at all', () => {
  it('renders the user icon, never an empty img', () => {
    render(<Avatar name="Carlos Velasquez" />);
    expect(img()).toBeNull();
    expect(icon()).not.toBeNull();
  });

  it('treats an empty string as no photo', () => {
    render(<Avatar photoURL="" name="Carlos" />);
    expect(img()).toBeNull();
  });

  it('carries the name for a screen reader even with no img to hold it', () => {
    render(<Avatar name="Carlos Velasquez" />);
    expect(screen.getByRole('img', { name: 'Carlos Velasquez' })).toBeDefined();
  });
});

describe('when the photo FAILS to load — the case that was broken', () => {
  it('swaps to the icon on error', () => {
    render(<Avatar photoURL="https://lh3.googleusercontent.com/a/blocked" name="Carlos" />);
    expect(img()).not.toBeNull();

    fireEvent.error(img()!);

    expect(img()).toBeNull();
    expect(icon()).not.toBeNull();
  });

  it('swaps to the icon when the load "succeeds" with zero width (ORB)', () => {
    // The one an onError-only guard misses. Opaque Response Blocking can let the
    // load complete with an empty image, which is exactly what produced the
    // broken-image icon on screen.
    render(<Avatar photoURL="https://lh3.googleusercontent.com/a/orb" name="Carlos" />);
    const el = img()!;
    Object.defineProperty(el, 'naturalWidth', { value: 0, configurable: true });

    fireEvent.load(el);

    expect(img()).toBeNull();
    expect(icon()).not.toBeNull();
  });

  it('keeps a photo that loads with real dimensions', () => {
    render(<Avatar photoURL="https://example.com/ok.png" name="Carlos" />);
    const el = img()!;
    Object.defineProperty(el, 'naturalWidth', { value: 96, configurable: true });

    fireEvent.load(el);

    expect(img()).not.toBeNull();
  });
});

describe('a new person in the same slot', () => {
  it('gets a fresh attempt after a previous failure', () => {
    // Without resetting on `photoURL`, one broken photo would make every later
    // avatar in a re-rendered list fall back too — a list of reviews is exactly
    // where that shows.
    const { rerender } = render(<Avatar photoURL="https://blocked/one" name="A" />);
    fireEvent.error(img()!);
    expect(img()).toBeNull();

    rerender(<Avatar photoURL="https://works/two" name="B" />);
    expect(img()).not.toBeNull();
  });
});
