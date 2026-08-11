// Firebase Storage photo upload (T075). Uploads under listings/{uid}/ so the
// storage rules permit only the owner to write (Constitution II). Uploads are
// best-effort: if Storage is not enabled/reachable, the caller can still save a
// listing without photos (the ActivityCard falls back to the sunset gradient).
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

export class PhotoUploadError extends Error {}

/** Accepted formats and size cap (feature 006, FR-022). */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export class PhotoRejected extends Error {
  constructor(readonly reason: 'type' | 'size') {
    super(reason);
  }
}

/**
 * Reject what Storage would accept but a traveler could not read.
 *
 * Checked before the upload starts, so a rejected file costs nothing and — this
 * is the part that matters — leaves the existing gallery untouched (FR-022).
 */
export function assertUploadable(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) throw new PhotoRejected('type');
  if (file.size > MAX_IMAGE_BYTES) throw new PhotoRejected('size');
}

export async function uploadListingPhoto(uid: string, file: File): Promise<string> {
  assertUploadable(file);
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  const path = `listings/${uid}/${safeName}`;
  try {
    const snap = await uploadBytes(ref(storage, path), file);
    return await getDownloadURL(snap.ref);
  } catch (err) {
    throw new PhotoUploadError(
      err instanceof Error ? err.message : 'Photo upload failed (is Firebase Storage enabled?)',
    );
  }
}
