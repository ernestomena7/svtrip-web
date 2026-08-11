// Where the auth guard was taking the visitor before it intervened.
//
// Its own module, deliberately. Living inside `Router.tsx` meant importing it
// pulled the entire route tree — and through it `@svtrip/core/firebase`, which
// calls `initializeApp` at module scope. A pure query-string helper should not
// need Firebase configured to be read, let alone to be tested.
import { useLocation } from 'react-router-dom';

/**
 * The `?next=` destination, or `null` when there is not a safe one.
 *
 * Only same-site absolute paths are honoured. Accepting a full URL here would
 * turn the sign-in screen into an open redirect: a phishing link could point
 * `?next=` at its own domain and use SVTrip's real sign-in page to get there.
 * `//evil.example` is rejected for the same reason — the browser reads it as
 * protocol-relative, so it leaves the site despite starting with a slash.
 */
export function useReturnTo(): string | null {
  const next = new URLSearchParams(useLocation().search).get('next');
  if (!next) return null;
  return next.startsWith('/') && !next.startsWith('//') ? next : null;
}
