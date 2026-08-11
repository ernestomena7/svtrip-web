// @svtrip/core — browser-side logic and brand mechanics shared by every SVTrip
// interface (mobile client, landing page, desktop web app).
//
// THE BOUNDARY, in one question: **does the Node server run this?**
//   - Yes  → `@svtrip/shared` (pure, dependency-free; the BFF consumes it).
//            `scoreSignalFor`, `coverImage` and the coordinate validators live
//            there for exactly this reason: the public featured endpoint runs
//            them server-side.
//   - No   → here. Firebase init, the auth context, repositories, the API
//            client, i18n, UI state, the icon set, the token mirror.
//
// Importing this package from the server would drag React and the Firebase Web
// SDK into the BFF's dependency graph — the coupling `shared/` exists to prevent.
//
// WHAT DOES NOT BELONG HERE: anything with a layout opinion. Buttons, cards,
// navigation, screens. Each interface builds its own — that independence is
// what keeps a change made for the desktop app out of reach of the mobile app's
// appearance (FR-040).
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS BARREL IS INTENTIONALLY EMPTY. Import by subpath instead:
//
//     import { auth, db } from '@svtrip/core/firebase';
//     import { useAuth } from '@svtrip/core/auth/AuthProvider';
//     import { fetchPlaces } from '@svtrip/core/repos/discoverRepo';
//     import '@svtrip/core/styles/tokens.css';
//
// Not a style preference — a re-export barrel would break FR-041. `firebase.ts`
// calls `initializeApp` at module scope, so any barrel that re-exports it
// initializes Firebase for whoever touches the barrel. The landing page needs
// i18n and tokens and nothing else; through a barrel it would pull in the whole
// Firebase Web SDK to get them, and the native app would start carrying code
// only the web interfaces use.
//
// Subpaths are resolved by the `"./*": "./src/*"` entry in package.json.
// ─────────────────────────────────────────────────────────────────────────────

export {};
