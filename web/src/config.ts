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
