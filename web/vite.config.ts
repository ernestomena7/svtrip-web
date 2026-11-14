import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Feature 022 (SC-008): the desktop app has no native shell, so its version IS its package.json —
// but read at BUILD time and injected, never typed into a component. A literal is correct until
// somebody forgets, and then it is a confident lie about which build is running.
const APP_VERSION: string = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf8'),
).version;

// Where the app is served from. `/` for a subdomain (app.svtrip.com), `/app/`
// for a subdirectory (svtrip.com/app). Set at BUILD time because asset URLs are
// baked into the HTML — a wrong value ships a page whose CSS and JS 404.
//
// Vite re-exposes this to the client as `import.meta.env.BASE_URL`, which is
// what the router uses for its basename, so the two can never disagree.
const BASE_PATH = process.env.APP_BASE_PATH || '/';

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
  // MapLibre's tile-parsing worker, carried over from the client verbatim.
  // Two distinct failures, both of which render a map with its background and
  // pin but NO roads, water or labels, and both entirely silent because a
  // worker that dies on startup reports nothing to the page:
  //
  //   1. dev: Vite's pre-bundler mangles the worker entry, which 404s as
  //      `.vite/deps/maplibre-gl-worker.mjs`. Excluding the package serves it
  //      straight from node_modules instead.
  //   2. build: the worker imports a sibling `maplibre-gl-shared.mjs` that a
  //      restricted origin cannot resolve. `worker.format: 'iife'` makes Rollup
  //      inline those dependencies into one self-contained file.
  //
  // This cost days to diagnose once. It is not re-derived per project.
  optimizeDeps: { exclude: ['maplibre-gl'] },
  worker: { format: 'iife' },
  // Read env from the repo root, same single .env as the rest of the monorepo.
  envDir: '../',
  server: { port: 5175 },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          motion: ['framer-motion'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'i18next', 'react-i18next', 'zustand'],
        },
      },
    },
  },
});
