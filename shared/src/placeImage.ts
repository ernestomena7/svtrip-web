// Which image represents a place on a card (feature 006 follow-up).
//
// One function, for the same reason `scoreSignalFor` and `resolveLocalized`
// exist: five call sites picking their own image is five chances to disagree,
// and a business whose card shows a different photo than its profile looks
// broken to the person who uploaded it.
//
// Discovered 2026-08-06: every ActivityCard call site simply omitted the image
// prop, so ALL cards fell back to the brand gradient — including the two
// businesses that had actually uploaded photos.
import type { Place } from './types.js';

/** The fields a cover-image decision depends on. */
export type ImageSource = Pick<Place, 'bannerURL' | 'photos' | 'gallery'>;

/**
 * The card's cover image, or `undefined` when the place genuinely has none.
 *
 * Order matches the profile screen's hero: the banner is the image the owner
 * deliberately chose to lead with, so a card that ignored it would contradict
 * the profile one tap away. Photos come next (the pre-005 field most legacy
 * entries use), then the gallery.
 *
 * Returning `undefined` rather than a placeholder is deliberate — `ActivityCard`
 * owns the fallback (the brand sunset gradient), and duplicating that choice
 * here would mean two components deciding what "no image" looks like.
 */
export function coverImage(source: Partial<ImageSource> | undefined): string | undefined {
  if (!source) return undefined;
  return source.bannerURL || source.photos?.[0] || source.gallery?.[0] || undefined;
}
