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
 * be baked in. The default is the landing's dev server port (5174), which keeps
 * the round trip working locally without any .env at all.
 *
 * This is the mirror of the landing's APP_SIGN_IN_URL: it links out to the
 * application, this links back. Both cross an origin boundary, so both are
 * plain URLs rather than router paths.
 */
export const LANDING_URL: string = envVar('VITE_LANDING_URL', 'http://localhost:5174');
