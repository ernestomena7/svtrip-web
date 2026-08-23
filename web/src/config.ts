// Runtime configuration for the desktop web app (feature 007).
//
// Same pattern as the landing's: read `import.meta.env` once and default, so a
// missing variable produces a working local default rather than a crash.
const viteEnv: Record<string, string | undefined> =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {};

function envVar(key: string, fallback: string): string {
  return viteEnv[key] ?? fallback;
}

/** The BFF. Also the origin that must appear in its `CORS_ORIGINS`. */
export const API_BASE_URL: string = envVar('VITE_BFF_BASE_URL', 'http://localhost:8787/api');

/**
 * The public landing page — where signing out returns a visitor.
 *
 * Environment-driven for the same reason the landing's own URLs are: the two
 * are SEPARATE deployments, so the address differs per environment and must not
 * be baked in. This is the mirror of the landing's APP_SIGN_IN_URL — it links
 * out to the application, this links back. Both cross an origin boundary, so
 * both are plain URLs rather than router paths.
 *
 * THE DEFAULT USED TO BE `http://localhost:5174`, the landing's dev port, and
 * that was a bug in two directions:
 *
 *   - Locally, the landing's dev server is usually NOT running while you work on
 *     the web app (`npm run dev` starts the BFF and the mobile client;
 *     `npm run dev:web` starts this one; the landing needs a third command). So
 *     signing out reliably landed on ERR_CONNECTION_REFUSED.
 *   - In production it was worse: `VITE_LANDING_URL` was referenced here and set
 *     NOWHERE — not in `.env`, not in `.env.example`, not in the deploy guide,
 *     which said the web app "needs only VITE_BFF_BASE_URL". A real build would
 *     therefore have shipped `localhost:5174` to real visitors.
 *
 * Falling back to this app's own origin means a missing variable degrades to a
 * page that exists — signed out, `/` renders the public preview — instead of a
 * connection error. The variable is now documented so the real landing is what
 * production actually uses.
 */
const ownOrigin = typeof window === 'undefined' ? '/' : window.location.origin;
export const LANDING_URL: string = envVar('VITE_LANDING_URL', ownOrigin);
