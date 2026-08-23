# svtrip-web

SVTrip's public marketing landing page and desktop web application — the two
deployments that go to [Hostinger](https://hostinger.com), independent of the
mobile app.

## What's here, and what isn't

This is a **deliberately lean subset** of the main SVTrip monorepo, exported
for a lighter Hostinger deployment. It contains:

- **`landing/`** — the public marketing page, prerendered to real HTML for two
  languages (Español/English).
- **`web/`** — the desktop web application (traveler + business surfaces).
- **`shared/`** — pure domain logic with no React or browser APIs. Also
  consumed by the BFF in the main repo, which is why it stays dependency-free.
- **`core/`** — browser-side logic shared between `landing/` and `web/`:
  Firebase, auth, data repositories, the icon set, the design token mirror.

**Not here**, and deliberately so: the mobile client (`client/`), the BFF
(`server/`), Firestore rules, and the feature specs. Those live in the main
project. This repo is a **copy of just the four packages above**, not a
`git subtree` — a change to `core/` or `shared/` in the main project has to be
copied here by hand. If that manual sync becomes painful, the fix is a real
`git subtree split`/`push` once the main project is itself under version
control, not a workaround here.

## Why `shared/` and `core/` are here at all

Neither `landing/` nor `web/` can build without them — they're npm workspace
dependencies, not vendored copies, resolved via symlinks that `npm install`
creates from this repo's own `workspaces` field. A build service (Hostinger's
"deploy from GitHub" flow included) needs the actual source to compile
against; it can't resolve `@svtrip/core` from a repo that doesn't contain it.

The rule that put each file on one side or the other: **does the Node BFF run
it?** `shared/` is pure enough that the server (not present in this repo)
imports it directly; `core/` carries React and the Firebase Web SDK, so it's
browser-only. Neither carries any layout-bearing component — no buttons, no
cards, no screens — which is what keeps this repo's existence from touching
the mobile app's appearance at all.

## Local development

```bash
npm install               # from the repo root — resolves the workspace symlinks
cp .env.example .env      # fill in the real values
npm run dev:landing       # http://localhost:5174
npm run dev:web           # http://localhost:5175
```

## Building for production

```bash
npm run build --workspace shared
npm run build --workspace landing   # → landing/dist/ (index.html + en.html, prerendered)
npm run build --workspace web       # → web/dist/ (SPA + .htaccess)
```

`web/` needs one more decision before building: is it going to a subdomain
(`app.svtrip.com`) or a subdirectory (`svtrip.com/app`)? See
`APP_BASE_PATH` in `.env.example` and the comment at the top of
`web/vite.config.ts` — asset URLs are baked in at build time, so this has to
be right before you build, not fixed after.

## Deploying

Both `landing/dist/` and `web/dist/` are **plain static files**. Neither needs
a Node process to run — upload them to Hostinger's `public_html/` (and
`public_html/app/`, or a subdomain's document root) and you're done.

`web/dist/.htaccess` is required for the desktop app's client-side routing to
work — without it, every deep link (`/place/el-tunco`, a reload on any route
other than `/`) 404s while the app itself is fine. Confirm it uploaded; many
FTP clients hide dotfiles by default.

### Deploying as a Node app from GitHub

Hostinger's "deploy a Node app from GitHub" flow expects ONE application at the
repository root: it runs `npm install`, then `npm run build`, then `npm start`.
This repo is two static sites instead, so `server.js` at the root is the adapter
between the two shapes. It renders nothing and imports nothing from the app — it
serves the `dist/` folders the build already produced.

```bash
npm install
npm run build
npm start          # honours PORT, defaults to 4173
```

Which surface it serves:

| `SVTRIP_SURFACE` | Serves |
|---|---|
| `landing` | the marketing page only |
| `web` | the desktop app only |
| *(unset)* | decides per request: an `app.*` Host gets the web app, anything else gets the landing |

That covers both Hostinger layouts without a rebuild: two application slots from
this one repo, or a single slot with both domains pointed at it.

It refuses to start if a `dist/` is missing, rather than coming up and serving
404s — a host that reports "running" while every request 404s is the hardest
kind of broken to diagnose from outside.

**Set `VITE_LANDING_URL=https://svtrip.com`** in the deploy environment. It is
read at runtime by the web app to send a visitor back to the marketing site on
sign-out; unset, it falls back to the app's own origin, so sign-out quietly
keeps people inside the app.

Note that the subdomain-vs-subdirectory choice is a **build** decision, not a
server one — `server.js` handles either, but `web/dist` has its base URL baked
in. See `APP_BASE_PATH` above.

## Two things in package.json that look wrong and are not

Both exist to close CVE-2026-12151 (undici WebSocket DoS, high). Deleting either
silently reintroduces it, and nothing will fail to tell you.

**1. `overrides.undici`.** Every `@firebase/*` package pins undici to an *exact*
`6.19.7` — no caret. The fix is `6.27.0`, in the same major, but npm cannot get
there on its own, which is why `npm audit` reports the only fix as `firebase@12`.
The override takes the patched version without dragging the SDK across two
majors.

**2. `firebase` in the root devDependencies.** The root does not import firebase —
`core/` does. It is listed anyway because **npm applies root `overrides` only to
the root package’s own dependency graph, not into a workspace’s**. Verified here
rather than assumed: with firebase declared only in `core/`, the override was
ignored across a plain install, `--package-lock-only`, and a full lockfile
regeneration, while a control override on `ms` (reached through the root’s own
`express`) applied immediately. Listing firebase at the root puts it in that
graph. It downloads nothing extra — the same install already had it.

Overrides placed in `core/package.json` are ignored entirely; npm honours them
only at the root of the install.

To check the pair is still doing its job:

```bash
npm ls undici --all      # every entry must be >= 6.27.0
npm audit                # undici must not appear
```

## Where everything else lives

| Piece | Where |
|---|---|
| Mobile app (Capacitor/Android/iOS) | Main monorepo, `client/` |
| BFF (holds `GEMINI_API_KEY`) | Main monorepo, `server/` → Cloud Run |
| Firebase Auth / Firestore / Storage | Managed by Firebase, no deploy step |
| Firestore security rules | Main monorepo, `firestore/` |

Full architecture, decisions and the reasoning behind them:
`specs/007-landing-web-app/` in the main monorepo.
