import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The landing page builds to plain static files: no server process is required
// to host it (FR-007), which is what lets it go on shared hosting. `server.ts`
// exists for the case where a Node host is available, but it serves this same
// output rather than rendering anything of its own.
//
// `prerender.ts` runs after this build and replaces the empty shell with real
// HTML for both languages (FR-008). Without that step a crawler and a link
// preview would see `<div id="root"></div>` and nothing else.
export default defineConfig({
  plugins: [react()],
  // Read env from the repo root, same single .env the rest of the monorepo uses.
  // Only VITE_-prefixed vars reach the browser.
  envDir: '../',
  server: { port: 5174 },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // The prerender is compiled by `vite build --ssr` and then run by Node, so
    // that pass must target Node rather than the browser baseline — the default
    // target rejects perfectly valid server-side syntax. Scoped to the SSR pass
    // only: setting it unconditionally would also retarget the browser bundle.
    target: process.argv.includes('--ssr') ? 'node20' : undefined,
  },
});
