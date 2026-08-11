// Regression test for a bug that hid every uploaded photo (2026-08-06): the
// ActivityCard accepted an `image` prop that no call site ever passed, so all
// cards fell back to the brand gradient — including businesses that had gone to
// the trouble of uploading photos. The failure was invisible because a gradient
// is exactly what a place with no photo is SUPPOSED to look like.
import { describe, expect, it } from 'vitest';
import { coverImage } from '../src/placeImage.js';

describe('coverImage', () => {
  it('prefers the banner — the image the owner chose to lead with', () => {
    // The profile screen uses the banner as its hero, so a card that picked a
    // different photo would contradict the profile one tap away.
    expect(
      coverImage({ bannerURL: 'banner.jpg', photos: ['p.jpg'], gallery: ['g.jpg'] }),
    ).toBe('banner.jpg');
  });

  it('falls back to the first photo when there is no banner', () => {
    expect(coverImage({ photos: ['p.jpg'], gallery: ['g.jpg'] })).toBe('p.jpg');
  });

  it('falls back to the gallery when that is all there is', () => {
    expect(coverImage({ gallery: ['g.jpg'] })).toBe('g.jpg');
  });

  it('returns undefined for a place with no images at all', () => {
    // Not a placeholder string: ActivityCard owns the gradient fallback, and
    // duplicating that decision here means two components disagreeing about
    // what "no image" looks like. 18 of 19 catalog entries are this case.
    expect(coverImage({ photos: [], gallery: [] })).toBeUndefined();
    expect(coverImage({})).toBeUndefined();
    expect(coverImage(undefined)).toBeUndefined();
  });

  it('treats an empty string as no image rather than a broken src', () => {
    // A blank bannerURL would otherwise render <img src=""> — a broken-image
    // icon, which is worse than the gradient it replaced.
    expect(coverImage({ bannerURL: '', photos: ['p.jpg'] })).toBe('p.jpg');
  });
});
