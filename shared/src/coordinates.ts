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

/**
 * The same two checks, for a FORM FIELD rather than a number.
 *
 * `isValidLat`/`isValidLng` take a number and cannot defend against absence:
 * `Number('')` is 0, and 0 is a perfectly valid latitude. So a listing form
 * that fed them `Number(lat)` accepted an untouched map and saved the business
 * at 0,0 — in the Gulf of Guinea — where every distance, "near you" and map
 * surface then read that position as real.
 *
 * That was live on BOTH surfaces. The header above already warned that "a blank
 * field must not read as a valid equator"; the warning could not be acted on
 * from inside a function that only ever sees a number, which is why the guard
 * belongs here, beside it, rather than repeated at each call site.
 */
export function isLatInput(v: string): boolean {
  return v.trim() !== '' && isValidLat(Number(v));
}

/** The longitude half of {@link isLatInput}. */
export function isLngInput(v: string): boolean {
  return v.trim() !== '' && isValidLng(Number(v));
}
