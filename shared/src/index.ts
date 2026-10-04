export * from './types.js';
export * from './api.js';
export * from './subscriptions.js';
export * from './businessTypes.js';
export * from './taxonomy.js';
export * from './i18nContent.js';
export * from './publication.js';
export * from './profile.js';
export * from './contact.js';
// Moved here from the mobile client in feature 007 (T010–T012): the public
// featured endpoint runs all three server-side, and `core/` carries React and
// the Firebase Web SDK, which the BFF must not depend on.
export * from './score.js';
export * from './placeImage.js';
export * from './coordinates.js';
// The clarification gate (feature 012). Lives here, not in core/, because the
// BFF is the only place that can save the tokens — and shared/ is the workspace
// defined by "does the Node server run it?".
export * from './clarification.js';
// Ranking and claims (feature 013). Here rather than in core/ for the same
// reason as the clarification gate: the BFF runs it.
export * from './promotion.js';
// The Discover redesign's pure logic (feature 014). All three are here rather
// than in core/ so they stay runnable by Node — which for `distance` is the
// point rather than a side effect: the traveler's position never leaves the
// device, so distance is computed beside the coordinates the client already
// holds and no request ever carries one.
export * from './distance.js';
export * from './search.js';
export * from './pricing.js';
export * from './calendarDay.js';
// The Trip ordering rule (feature 016). Here rather than in core/ for the
// reason that defines this workspace — but note the test is not "does the BFF
// run it?" this time: no server code calls it and none should. It is here
// because TWO CLIENT SURFACES must agree, and shared/ is the only workspace
// both import that cannot drag React into a consumer.
export * from './tripOrder.js';
// When a stop may be scheduled (feature 016). Beside `tripOrder` and for the
// same reason: both surfaces render the refusal, and two implementations of
// "is this date too early" drift the moment one starts parsing.
export * from './tripSchedule.js';
// Merchant subscription plans (feature 018). All three are here rather than in
// core/ because the BFF runs them: `catalogService.getPlaces()` has to exclude
// a suspended place from the AI Guide's allow-list. `subscriptionState` carries
// no clock of its own, which is what lets a test walk 90 days in a
// millisecond. `benchmark.js` joins them for US2's category comparison.
export * from './subscriptionState.js';
export * from './subscriptionCoverage.js';
export * from './benchmark.js';
// The expanded metrics' aggregation (feature 018). Here rather than in core/
// for feature 016's reason: BOTH client surfaces must agree, and a module in
// core/ cannot be unit-tested because `core/firebase` initialises at import.
export * from './providerMetrics.js';
