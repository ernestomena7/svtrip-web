// A person's avatar, with a fallback that actually fires.
//
// WHY THIS EXISTS
//
// Every avatar in the product used to be `photoURL ? <img/> : <initial/>`, which
// only falls back when the URL is ABSENT. The reviews on a place profile showed a
// broken-image icon instead, and the reason is worth knowing because it affects
// every Google account:
//
//   Google serves profile photos from `lh3.googleusercontent.com` without the
//   CORS headers Chrome now requires for a cross-origin subresource, so the
//   browser blocks the response with `net::ERR_BLOCKED_BY_ORB` (Opaque Response
//   Blocking). The URL is perfectly valid — `curl` returns 200 and a 10 KB PNG —
//   it just cannot be rendered as an `<img>` from our origin.
//
// The image is therefore PRESENT and BROKEN, which the old check could not see.
// Measured when this was written: all 5 reviews in the catalog were written by
// Google accounts, so all 5 showed the broken icon.
//
// This component handles the failure rather than the absence: it swaps to the
// brand's user icon when the load fails, and also when it "succeeds" with zero
// dimensions — which is what ORB produces (`complete: true`, `naturalWidth: 0`),
// and what an `onError`-only guard would miss.
import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export interface AvatarProps {
  /** May be absent, or present and unloadable. Both end up as the icon. */
  photoURL?: string | null;
  /** Rendered as the accessible name; never drawn as text. */
  name?: string;
  /** Box size in px. The icon is scaled from it. */
  size?: number;
  className?: string;
}

export function Avatar({ photoURL, name, size = 36, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  // A different traveler in the same slot deserves a fresh attempt — without
  // this, one broken photo would make every subsequent avatar in a re-rendered
  // list fall back too.
  useEffect(() => setFailed(false), [photoURL]);

  const showImage = Boolean(photoURL) && !failed;

  return (
    <span
      className={
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-muted ' +
        (className ?? '')
      }
      style={{ width: size, height: size }}
      // The name goes here rather than on the img: when the fallback icon is
      // showing there is no img to carry it, and a screen reader still needs to
      // know whose avatar this is.
      role="img"
      aria-label={name || undefined}
    >
      {showImage ? (
        <img
          src={photoURL as string}
          alt=""
          className="h-full w-full object-cover"
          // Blocked, 404, offline — all the same outcome.
          onError={() => setFailed(true)}
          // ORB does not always reach onError: the load can "complete" with an
          // empty image. Zero natural width is the only reliable tell.
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth === 0) setFailed(true);
          }}
        />
      ) : (
        <Icon name="user" size={Math.round(size * 0.55)} />
      )}
    </span>
  );
}
