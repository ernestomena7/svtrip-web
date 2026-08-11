// What counts as a usable coordinate (feature 007, T012).
//
// Lifted out of `CoordinatePicker.tsx`, where these two predicates had been
// living inside a React component file since feature 001. They are pure
// functions over numbers with no UI opinion, and three surfaces now need them:
// the mobile client's map picker, the desktop app's, and any server-side
// validation of a saved location.
//
// They stay in `shared/` rather than `core/` for the same reason `score.ts` and
// `placeImage.ts` do — nothing here touches React or a browser API, so the BFF
// can import them without dragging a browser SDK into its dependency graph.
//
// `Number.isFinite` is the load-bearing part: `Number('')` is 0 and
// `Number('abc')` is NaN, and a blank field must not read as a valid equator.

/** A latitude within the real range, and actually a number. */
export function isValidLat(v: number): boolean {
  return Number.isFinite(v) && v >= -90 && v <= 90;
}

/** A longitude within the real range, and actually a number. */
export function isValidLng(v: number): boolean {
  return Number.isFinite(v) && v >= -180 && v <= 180;
}
