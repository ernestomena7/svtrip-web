// What is switched on in this build.
//
// WHY A FLAG AND NOT A DELETION.
//
// The AI guide is being taken out of the MVP because it is not ready, not
// because it is wrong — the product owner's words were "a futuro lo
// trabajaremos". Deleting four features' worth of work (004, 012, 013, 015) to
// hide a button would make bringing it back a rebuild rather than a switch.
//
// So the code stays, every door closes, and turning it back on is changing ONE
// value here. The tests stay too, gated on this same flag: a deleted test does
// not come back when the feature does.
//
// WHY `shared/` AND NOT A PER-SURFACE CONSTANT.
//
// Feature 016's rule: a thing both client surfaces must agree on lives here. A
// flag duplicated per surface is how the guide ends up hidden on the phone and
// reachable on the desktop — which is exactly the shape of the defect feature
// 014 left in desktop Discover and that is still live today.

/**
 * Is the AI guide reachable?
 *
 * `false` closes every door to it on BOTH surfaces:
 *   - the labelled control feature 017 put on Explorar and on Trips
 *   - the desktop nav entry
 *   - the `/guide` route itself, which redirects rather than rendering
 *
 * WHAT THIS DOES NOT DO, deliberately:
 *   - It does not disable the BFF's chat routes. They are authenticated and
 *     cost nothing when nobody calls them, and leaving them up means turning
 *     the flag back on needs no deploy of the server.
 *   - It does not touch `/api/spin`. The Spin the Wheel on Discover is feature
 *     001's and has nothing to do with the guide — switching it off with
 *     "the AI stuff" would remove a working traveler feature by association.
 *
 * KNOWN CONSEQUENCE, accepted by the product owner rather than worked around:
 * feature 016 gave Trips two origins — built by hand, or kept from a plan the
 * guide proposed. With the guide unreachable the second origin is unreachable
 * too. Nothing is deleted and no existing Trip changes; there is simply no way
 * to create one that way while this is off.
 */
export const AI_GUIDE_ENABLED = false;
