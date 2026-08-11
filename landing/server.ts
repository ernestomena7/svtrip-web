// Optional Node host for the landing page (feature 007, T054).
//
// The build output is plain static files and needs no server at all — that is
// FR-007, and it is what lets the landing go on shared hosting for the price of
// a folder. This exists for the case where a Node runtime IS available and the
// product owner would rather run it here than configure a static host.
//
// It renders nothing. It serves `dist/`, which `prerender.ts` already filled
// with real HTML. If this file ever starts rendering, the static deployment and
// the Node deployment stop being the same page, and only one of them gets tested.
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, 'dist');
const port = Number(process.env.PORT ?? 4173);

const app = express();

// Long cache for fingerprinted assets, none for the HTML — otherwise a visitor
// keeps the old page after a deploy and the "live" showcase is the least of it.
app.use(
  '/assets',
  express.static(resolve(dist, 'assets'), { immutable: true, maxAge: '1y' }),
);
app.use(express.static(dist, { maxAge: 0, etag: true }));

// Spanish is the default document; English is a real file, not a redirect.
app.get('/en', (_req, res) => res.sendFile(resolve(dist, 'en.html')));

app.use((_req, res) => res.status(404).sendFile(resolve(dist, 'index.html')));

app.listen(port, () => {
  console.log(`[svtrip] landing served from dist/ on http://localhost:${port}`);
});
