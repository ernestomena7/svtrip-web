// Where the landing page sends people, and where it reads the showcase from
// (feature 007, T057).
//
// Both are environment-driven because the landing and the application are
// SEPARATE deployments (the product owner's decision), so their addresses differ
// per environment and must not be baked into the source.
//
// READ THIS BEFORE CHANGING THE ACCESSOR: this module is imported by BOTH the
// browser bundle and `prerender.ts`, which runs in Node. `import.meta.env` is a
// Vite construct and is simply `undefined` under Node, so touching
// `import.meta.env.SOMETHING` directly crashes the prerender — with a stack
// trace pointing at this file and no mention of the real cause.
//
// Vite replaces the whole `import.meta.env` expression with an object at build
// time, so reading it once and defaulting to `{}` is safe in both places.

const viteEnv: Record<string, string | undefined> =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

/** Vite value in the browser, `process.env` during the Node prerender, then the default. */
function envVar(key: string, fallback: string): string {
  const fromNode = typeof process !== 'undefined' ? process.env?.[key] : undefined;
  return viteEnv[key] ?? fromNode ?? fallback;
}

/**
 * The web application's sign-in screen.
 *
 * The landing deliberately does NOT host a sign-in form. Firebase Auth stores
 * its session per origin, so a form here would leave the session on the wrong
 * domain and the visitor would arrive at the app still signed out. Linking is
 * not a limitation — it is what makes two separate deployments work at all.
 */
export const APP_SIGN_IN_URL: string = envVar(
  'VITE_APP_SIGN_IN_URL',
  'http://localhost:5175/sign-in',
);

/** Where a visitor who already has a session should land. */
export const APP_URL: string = envVar('VITE_APP_URL', 'http://localhost:5175');

/** The BFF, for the public featured endpoint. Nothing else is called from here. */
export const API_BASE_URL: string = envVar('VITE_BFF_BASE_URL', 'http://localhost:8787/api');
