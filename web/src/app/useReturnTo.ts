// Where the auth guard was taking the visitor before it intervened.
//
// Its own module, deliberately. Living inside `Router.tsx` meant importing it
// pulled the entire route tree — and through it `@svtrip/core/firebase`, which
// calls `initializeApp` at module scope. A pure query-string helper should not
// need Firebase configured to be read, let alone to be tested.
import { useLocation } from 'react-router-dom';

/**
 * Is this `?next=` value a destination that stays on this site?
 *
 * Exported so it can be tested as what it is — a pure string decision — without
 * a router in the way.
 *
 * Accepting a full URL here would turn the sign-in screen into an open
 * redirect: a phishing link could point `?next=` at its own domain and use
 * SVTrip's real sign-in page to get there.
 *
 * The rule is "starts with exactly one slash", and it has to be written in
 * terms of BOTH slash characters. The previous version tested
 * `startsWith('/') && !startsWith('//')`, which reads correct and is not:
 * browsers normalise a backslash to a forward slash while parsing the
 * authority, so `/\evil.example` passed both checks and then resolved to
 * `https://evil.example/`. That was a live open redirect.
 *
 *   new URL('/\\evil.example', 'https://app.svtrip.com').host  // 'evil.example'
 *
 * Hence a character class rather than a pair of string comparisons: every
 * separator the URL parser treats as a separator has to be treated as one here
 * too, and there is no third variant to forget.
 */
export function isSafeReturnTo(next: string): boolean {
  // Rooted at a forward slash, and not followed by a second separator of
  // EITHER kind. The character class is the whole fix.
  return next.startsWith('/') && !/^[/\\]{2}/.test(next);
}

/** The `?next=` destination, or `null` when there is not a safe one. */
export function useReturnTo(): string | null {
  const next = new URLSearchParams(useLocation().search).get('next');
  if (!next) return null;
  return isSafeReturnTo(next) ? next : null;
}
