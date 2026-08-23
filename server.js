// Node host for Hostinger's "deploy a Node app from GitHub" flow.
//
// That flow expects ONE application at the repository root: it runs
// `npm install`, then `npm run build`, then `npm start`. This repo builds two
// independent static sites instead, so this file is the adapter between the two
// shapes. It is deployment plumbing, not part of the product.
//
// It renders nothing and it imports nothing from the app. Both `landing/dist`
// and `web/dist` are already complete static output — the landing is real
// prerendered HTML written by `prerender.ts`, and the web app is a Vite bundle.
// If this file ever starts rendering, the static deployment and the Node
// deployment stop being the same site and only one of them gets tested.
//
// WHICH SURFACE IT SERVES
//
// Set `SVTRIP_SURFACE` to pin one:
//
//   SVTRIP_SURFACE=landing   svtrip.com
//   SVTRIP_SURFACE=web       app.svtrip.com
//
// Unset, it decides per REQUEST from the Host header: anything on an `app.`
// hostname gets the web app, everything else gets the landing. That covers both
// Hostinger layouts without a rebuild — two application slots from this one
// repo, or a single slot with both domains pointed at it.
//
// The web app is built with base `/` (the default), which is what a subdomain
// needs. A subdirectory layout — svtrip.com/app — is a different BUILD, not a
// different server: see APP_BASE_PATH in web/vite.config.ts.
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const LANDING_DIST = resolve(here, 'landing/dist');
const WEB_DIST = resolve(here, 'web/dist');
const port = Number(process.env.PORT ?? 4173);
const pinned = process.env.SVTRIP_SURFACE;

// Fail loudly at startup rather than serving 404s for a missing build. A host
// that reports "running" while every request 404s is the hardest kind of broken
// to diagnose from the outside.
for (const [name, dir] of [
  ['landing', LANDING_DIST],
  ['web', WEB_DIST],
]) {
  if (pinned && pinned !== name) continue;
  if (!existsSync(resolve(dir, 'index.html'))) {
    console.error(
      `[svtrip] ${dir}/index.html is missing. Run \`npm run build\` before \`npm start\`.`,
    );
    process.exit(1);
  }
}

/** Long cache for fingerprinted assets, none for HTML. */
function surface(dist) {
  const router = express.Router();
  // Vite fingerprints everything under /assets, so those files are immutable by
  // construction. The HTML must NOT be cached, or a visitor keeps the previous
  // deploy's page — and with it the previous deploy's asset URLs, which no
  // longer exist.
  router.use('/assets', express.static(resolve(dist, 'assets'), { immutable: true, maxAge: '1y' }));
  router.use(express.static(dist, { maxAge: 0, etag: true }));
  return router;
}

const landing = express.Router();
landing.use(surface(LANDING_DIST));
// Spanish is the default document; English is a real prerendered file, not a
// redirect — that is what makes it work in a search result and a link preview.
landing.get('/en', (_req, res) => res.sendFile(resolve(LANDING_DIST, 'en.html')));
landing.use((_req, res) => res.status(404).sendFile(resolve(LANDING_DIST, 'index.html')));

const web = express.Router();
web.use(surface(WEB_DIST));
// SPA fallback. `web/dist/.htaccess` does this under Apache; under Node it has
// to be done here, or every deep link and every page reload 404s while the app
// itself is perfectly fine.
web.use((_req, res) => res.sendFile(resolve(WEB_DIST, 'index.html')));

const app = express();
app.disable('x-powered-by');

if (pinned === 'landing') {
  app.use(landing);
} else if (pinned === 'web') {
  app.use(web);
} else {
  app.use((req, res, next) =>
    req.hostname.startsWith('app.') ? web(req, res, next) : landing(req, res, next),
  );
}

app.listen(port, () => {
  const mode = pinned ? `pinned to ${pinned}` : 'routing by Host header';
  console.log(`[svtrip] listening on ${port} — ${mode}`);
});
