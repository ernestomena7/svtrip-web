// Photo upload (T075) — Supabase Storage, the `media` bucket (feature 023). Uploads under
// listings/{uid}/ so the storage policies permit only the owner to write (Constitution II).
// Uploads are best-effort: if Storage is unreachable, the caller can still save a listing without
// photos (the ActivityCard falls back to the sunset gradient).
import { supabase } from '../supabase';

const BUCKET = 'media';

export class PhotoUploadError extends Error {}

/**
 * Accepted formats and size cap (feature 006, FR-022). The `media` bucket enforces the SAME two
 * limits server-side (storage_023.sql: file_size_limit, allowed_mime_types). Keep them in step: if
 * they drift, the symptom is an upload the UI accepts and the server refuses.
 */
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
  const store = supabase.storage.from(BUCKET);
  const { error } = await store.upload(path, file, { contentType: file.type });
  if (error) throw new PhotoUploadError(error.message || 'Photo upload failed');
  // Public bucket, as the old one was: an <img src> carries no token.
  return store.getPublicUrl(path).data.publicUrl;
}
