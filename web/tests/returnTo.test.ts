// The open redirect that got through, and the shape of the fix.
//
// `useReturnTo` accepted `?next=` when it started with `/` and did not start
// with `//`. A backslash defeats that: browsers normalise `\` to `/` while
// parsing the authority, so `/\evil.example` passes both checks and then
// resolves to `https://evil.example/`. The sign-in screen would have carried a
// visitor off-site under SVTrip's own domain — which is the whole point of an
// open redirect in a phishing chain.
//
// The predicate is tested rather than the hook: the rule is a pure string
// decision, and running it through React Router would only add a renderer
// between the assertion and the thing being asserted.
import { describe, it, expect } from 'vitest';
import { isSafeReturnTo } from '../src/app/useReturnTo';

describe('destinations that leave the site are refused', () => {
  it('refuses a protocol-relative URL', () => {
    expect(isSafeReturnTo('//evil.example')).toBe(false);
  });

  it('refuses a backslash-derived one — the bypass that shipped', () => {
    // This is the regression. It passed the old guard.
    expect(isSafeReturnTo('/\\evil.example')).toBe(false);
    expect(new URL('/\\evil.example', 'https://app.svtrip.com').host).toBe('evil.example');
  });

  it('refuses the mixed forms a filter written once tends to miss', () => {
    expect(isSafeReturnTo('/\\/evil.example')).toBe(false);
    expect(isSafeReturnTo('\\\\evil.example')).toBe(false);
    expect(isSafeReturnTo('\\/evil.example')).toBe(false);
  });

  it('refuses an absolute URL', () => {
    expect(isSafeReturnTo('https://evil.example/pwned')).toBe(false);
    expect(isSafeReturnTo('javascript:alert(1)')).toBe(false);
  });

  it('refuses anything not rooted at a slash', () => {
    expect(isSafeReturnTo('place/el-tunco')).toBe(false);
    expect(isSafeReturnTo('')).toBe(false);
  });
});

describe('real in-app destinations still work', () => {
  it('honours a same-site path', () => {
    expect(isSafeReturnTo('/place/el-tunco')).toBe(true);
    expect(isSafeReturnTo('/mis-negocios')).toBe(true);
  });

  it('honours a path with a query and a hash', () => {
    expect(isSafeReturnTo('/explorar?mood=beach')).toBe(true);
    expect(isSafeReturnTo('/place/el-tunco#resenas')).toBe(true);
  });
});
