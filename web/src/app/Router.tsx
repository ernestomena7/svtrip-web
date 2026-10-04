// Routing and the signed-out boundary (feature 007, T067/T069/T070).
//
// `BrowserRouter` sits ABOVE the auth guard, deliberately. Feature 003 learned
// this the hard way: with the guard on the outside, a password-reset email
// opened by a signed-out user could not match `/reset-password?oobCode=…`
// because no router had mounted yet, and the link looked broken.
//
// Three behaviours worth naming:
//
//   1. **Signed out is not a dead end.** The catalog preview is public
//      (FR-018); everything else redirects to sign-in carrying WHERE the visitor
//      was going, and lands them there afterwards (FR-018b). A shared link to a
//      place must survive the detour, or sharing links is pointless.
//   2. **Session persists across reloads and deep links** (FR-013). That is the
//      Firebase SDK's job; ours is to wait for it — rendering the signed-out
//      tree while `loading` is true would flash the preview at a signed-in user
//      on every refresh.
//   3. **Only the active persona's routes are mounted**, matching the mobile
//      app: a stale URL for the other mode falls through to that persona's index
//      rather than rendering a screen the nav never links to.
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isProfileComplete, predatesProfileFields } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { useUiStore } from '@svtrip/core/uiStore';
import { Spinner } from '../components/ui';
import { DesktopLayout } from '../shell/DesktopLayout';
import { PreviewScreen } from '../public/PreviewScreen';
import { SignInScreen } from '../auth/SignInScreen';
import { RegisterScreen } from '../auth/RegisterScreen';
import { ForgotPasswordScreen } from '../auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../auth/ResetPasswordScreen';
import { useReturnTo } from './useReturnTo';

// Re-exported for the screens that already import it from here.
export { useReturnTo };

// Route-level splitting, same reasoning as the mobile app: the map and the
// business forms are heavy and most visitors never open them.
const DiscoverScreen = lazy(() =>
  import('../traveler/DiscoverScreen').then((m) => ({ default: m.DiscoverScreen })),
);
const PlaceProfileScreen = lazy(() =>
  import('../traveler/PlaceProfileScreen').then((m) => ({ default: m.PlaceProfileScreen })),
);
const AIGuideScreen = lazy(() =>
  import('../traveler/AIGuideScreen').then((m) => ({ default: m.AIGuideScreen })),
);
const DealsScreen = lazy(() =>
  import('../traveler/DealsScreen').then((m) => ({ default: m.DealsScreen })),
);
const TripsScreen = lazy(() =>
  import('../traveler/TripsScreen').then((m) => ({ default: m.TripsScreen })),
);
const TripDetailScreen = lazy(() =>
  import('../traveler/TripDetailScreen').then((m) => ({ default: m.TripDetailScreen })),
);
const FavoritesScreen = lazy(() =>
  import('../traveler/FavoritesScreen').then((m) => ({ default: m.FavoritesScreen })),
);
const ProfileScreen = lazy(() =>
  import('../traveler/ProfileScreen').then((m) => ({ default: m.ProfileScreen })),
);

// Business surfaces. Split hardest of all: the listing form pulls in MapLibre,
// and a traveler who never switches personas must not download a map library.
const DashboardScreen = lazy(() =>
  import('../business/DashboardScreen').then((m) => ({ default: m.DashboardScreen })),
);
const MyBusinessesScreen = lazy(() =>
  import('../business/MyBusinessesScreen').then((m) => ({ default: m.MyBusinessesScreen })),
);
const SubscriptionScreen = lazy(() =>
  import('../business/SubscriptionScreen').then((m) => ({ default: m.SubscriptionScreen })),
);
const ClaimBusinessScreen = lazy(() =>
  import('../business/ClaimBusinessScreen').then((m) => ({ default: m.ClaimBusinessScreen })),
);

// The first-run completion step (feature 011). Rendered by the gate below rather
// than mounted as a route: it is a checkpoint, not a destination, and giving it
// a URL would let a traveler bookmark their way past the very thing it gates.
const CompleteProfileScreen = lazy(() =>
  import('../account/CompleteProfileScreen').then((m) => ({ default: m.CompleteProfileScreen })),
);
const ChooseMoodsScreen = lazy(() =>
  import('../account/ChooseMoodsScreen').then((m) => ({ default: m.ChooseMoodsScreen })),
);

// Super-admin only (feature 010), and web only by product decision. Split like
// the rest: almost nobody who signs in will ever load this bundle.
const TaxonomyScreen = lazy(() =>
  import('../admin/TaxonomyScreen').then((m) => ({ default: m.TaxonomyScreen })),
);

const Loading = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <Spinner />
  </div>
);

function SignedOutRoutes() {
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);

  return (
    <Routes>
      <Route path="/sign-in" element={<SignInScreen />} />
      <Route path="/register" element={<RegisterScreen />} />
      <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
      {/* The public preview — the one signed-out surface with real content. */}
      <Route path="/" element={<PreviewScreen />} />
      <Route path="/discover" element={<PreviewScreen />} />
      {/* Anything else is gated: say so, and remember where they were going. */}
      <Route path="*" element={<Navigate to={`/sign-in?next=${next}`} replace />} />
    </Routes>
  );
}

function SignedInRoutes() {
  const persona = useUiStore((s) => s.persona);
  const index = persona === 'provider' ? '/dashboard' : '/discover';

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        {/* Already signed in: the auth screens have nothing left to offer. */}
        <Route path="/sign-in" element={<Navigate to={index} replace />} />
        <Route path="/register" element={<Navigate to={index} replace />} />
        <Route path="/" element={<Navigate to={index} replace />} />

        <Route path="/discover" element={<DiscoverScreen />} />
        <Route path="/place/:id" element={<PlaceProfileScreen />} />
        <Route path="/guide" element={<AIGuideScreen />} />
        {/* Traveler-only, like the nav link that reaches them. The
            provider links are untouched (FR-046). */}
        <Route path="/trips" element={<TripsScreen />} />
        <Route path="/trips/:id" element={<TripDetailScreen />} />
        <Route path="/deals" element={<DealsScreen />} />
        <Route path="/saved" element={<FavoritesScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />

        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/businesses" element={<MyBusinessesScreen />} />
        <Route path="/subscription" element={<SubscriptionScreen />} />
        <Route path="/claim" element={<ClaimBusinessScreen />} />

        {/* Mounted for every signed-in account on purpose: the screen itself
            checks the claim and redirects, and the BFF refuses every write
            regardless. Mounting it conditionally would leak who is a super
            admin — a non-admin would get a redirect from the guard while an
            admin got a screen, but an UNMOUNTED route 404s differently. */}
        <Route path="/admin/taxonomy" element={<TaxonomyScreen />} />

        <Route path="*" element={<Navigate to={index} replace />} />
      </Routes>
    </Suspense>
  );
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  // FR-013: wait for the SDK to restore the session. Rendering the signed-out
  // tree here would flash the preview screen on every reload for a signed-in
  // visitor, and briefly redirect deep links to sign-in for no reason.
  if (loading) return <Loading />;

  if (!user) return <SignedOutRoutes />;

  // The first-run gate (feature 011). This surface has never had one — the same
  // gap feature 009 found for moods, and the reason a web-only account could
  // never set them.
  //
  // The `profileVersion` condition is what makes grandfathering work. An account
  // created before feature 011 carries no stamp and is NEVER stopped here
  // (FR-018); it gets a non-blocking invitation on its profile screen instead.
  // Only an account born after the feature — which should have been asked at
  // signup — can be missing something it was actually asked for.
  if (profile && !predatesProfileFields(profile) && !isProfileComplete(profile)) {
    return (
      <Suspense fallback={<Loading />}>
        <CompleteProfileScreen />
      </Suspense>
    );
  }

  // Then the moods, in that order — "who are you" precedes "what do you like",
  // matching the mobile app exactly.
  //
  // Unlike the step above this one carries NO profileVersion condition, and it
  // must not: `onboardingComplete` is a field the product has had since feature
  // 001, so an older account already answered this and is already `true`.
  // Measured against the live project before shipping: of 32 real accounts,
  // exactly one is not `true` — the one created while testing this flow. Adding
  // a grandfathering condition here would instead permanently exempt the only
  // accounts that genuinely never chose.
  if (profile && !profile.onboardingComplete) {
    return (
      <Suspense fallback={<Loading />}>
        <ChooseMoodsScreen />
      </Suspense>
    );
  }

  return <SignedInRoutes />;
}

export function Router() {
  // Vite derives this from the build's `base`, so the router and the asset URLs
  // are guaranteed to agree. `/` for a subdomain, `/app/` for a subdirectory —
  // the deployment decides, and nothing in the source has to change.
  const basename = import.meta.env.BASE_URL;

  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  );
}

export { DesktopLayout };
