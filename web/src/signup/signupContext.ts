// Feature 025: what the sign-up flow must carry across a page load and a Google round trip.
//
// `signInWithGoogle()` returns to `origin + pathname`, which keeps the path and DROPS the query
// (research R1b). So the link origin and the language are written to sessionStorage before leaving,
// and read back URL-first: a fresh link always wins over a remembered one.
import { normaliseOrigin } from '@svtrip/shared';

const KEY = 'svtrip-signup';
const DRAFT_KEY = 'svtrip-signup-draft';

export interface SignupContext {
  origin: string;
  lang: 'es' | 'en';
}

export const SIGNUP_PATHS = ['/negocios/registro', '/en/business/register'] as const;
export const isSignupPath = (pathname: string) => SIGNUP_PATHS.some((p) => pathname === p || pathname === `${p}/`);

function stored(): Partial<SignupContext> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Partial<SignupContext>;
  } catch {
    return {};
  }
}

export function readSignupContext(search: string, pathname: string): SignupContext {
  const params = new URLSearchParams(search);
  const remembered = stored();
  const rawOrigin = params.get('src') ?? params.get('utm_source');
  const origin = rawOrigin !== null ? normaliseOrigin(rawOrigin) : remembered.origin ?? 'direct';
  const urlLang = params.get('lang');
  const lang: 'es' | 'en' =
    urlLang === 'en' || urlLang === 'es' ? urlLang : pathname.startsWith('/en/') ? 'en' : remembered.lang ?? 'es';
  return { origin, lang };
}

export function rememberSignupContext(ctx: SignupContext): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ctx));
  } catch {
    /* private mode: the URL still carries it on this load */
  }
}

/** Step 2's draft survives a reload or a detour (FR-015); photos are already-uploaded URLs. */
export function loadDraft<T>(): Partial<T> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') as Partial<T>;
  } catch {
    return {};
  }
}

export function saveDraft<T>(draft: T): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* best effort */
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* best effort */
  }
}
