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

## Where everything else lives

| Piece | Where |
|---|---|
| Mobile app (Capacitor/Android/iOS) | Main monorepo, `client/` |
| BFF (holds `GEMINI_API_KEY`) | Main monorepo, `server/` → Cloud Run |
| Firebase Auth / Firestore / Storage | Managed by Firebase, no deploy step |
| Firestore security rules | Main monorepo, `firestore/` |

Full architecture, decisions and the reasoning behind them:
`specs/007-landing-web-app/` in the main monorepo.
