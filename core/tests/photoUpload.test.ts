// photoUpload.ts (feature 023, T056): the client-side half of a Storage upload.
//
// NEW FILE. The code was ported before this task was checked off, with no test pinning it — the
// same shape T049 found for authErrors.ts. `assertUploadable` is pure and cheap to test, and it is
// the gate that keeps an unreadable or oversized file from ever reaching the network: the server-side
// half (the bucket's own 5 MB / mime-type limits, and that only the owner's folder is writable) is
// asserted separately, against the real database, in supabase/tests/storage.rls.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));

const { assertUploadable, uploadListingPhoto, PhotoRejected, PhotoUploadError, MAX_IMAGE_BYTES, ACCEPTED_IMAGE_TYPES } =
  await import('../src/repos/photoUpload');

beforeEach(() => fake.reset());

function file(name: string, type: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe('assertUploadable', () => {
  it('accepts every type the bucket also accepts — kept in step with storage_023.sql', () => {
    // If this list drifts from the bucket's `allowed_mime_types`, the symptom is an upload the UI
    // accepts and the server refuses (the comment in both files).
    expect(ACCEPTED_IMAGE_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(() => assertUploadable(file('a', type, 1024))).not.toThrow();
    }
  });

  it('rejects a type the bucket does not accept', () => {
    expect(() => assertUploadable(file('a.pdf', 'application/pdf', 1024))).toThrow(PhotoRejected);
    try {
      assertUploadable(file('a.pdf', 'application/pdf', 1024));
    } catch (e) {
      expect((e as InstanceType<typeof PhotoRejected>).reason).toBe('type');
    }
  });

  it('rejects a file over the 5 MB cap, and accepts one exactly at it', () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
    expect(() => assertUploadable(file('a.jpg', 'image/jpeg', MAX_IMAGE_BYTES))).not.toThrow();
    try {
      assertUploadable(file('a.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1));
      throw new Error('expected a throw');
    } catch (e) {
      expect((e as InstanceType<typeof PhotoRejected>).reason).toBe('size');
    }
  });

  it('checks TYPE before SIZE — a bad-type, oversized file reports the type refusal', () => {
    try {
      assertUploadable(file('a.pdf', 'application/pdf', MAX_IMAGE_BYTES + 1));
      throw new Error('expected a throw');
    } catch (e) {
      expect((e as InstanceType<typeof PhotoRejected>).reason).toBe('type');
    }
  });
});

describe('uploadListingPhoto', () => {
  it('a rejected file never reaches Storage — costs nothing, leaves the gallery untouched', async () => {
    await expect(uploadListingPhoto('owner-1', file('a.pdf', 'application/pdf', 1024))).rejects.toBeInstanceOf(PhotoRejected);
    expect(fake.storageUploads).toHaveLength(0);
  });

  it('uploads under listings/{uid}/, with the content type set, and returns the public URL', async () => {
    const url = await uploadListingPhoto('owner-1', file('cafe.jpg', 'image/jpeg', 1024));
    expect(fake.storageUploads).toHaveLength(1);
    const [{ path, options }] = fake.storageUploads;
    expect(path).toMatch(/^listings\/owner-1\/\d+-cafe\.jpg$/);
    expect(options).toEqual({ contentType: 'image/jpeg' });
    expect(url).toBe(`https://cdn.test/${path}`);
  });

  it('sanitizes an unsafe filename rather than passing it through to the storage key', () => {
    // Spaces, accents and slashes in a traveler-chosen filename must not become part of the storage
    // PATH — a `/` here would upload outside the owner's folder the policy scopes them to.
    fake.reset();
    return uploadListingPhoto('owner-1', file('fotó del café/menú.jpg', 'image/jpeg', 1024)).then((url) => {
      const [{ path }] = fake.storageUploads;
      // Exactly three segments: the `/` inside the traveler's filename did not add a fourth.
      expect(path.split('/')).toHaveLength(3);
      expect(path).toMatch(/^listings\/owner-1\/\d+-[a-zA-Z0-9.\-_]+$/);
      expect(url.endsWith(path)).toBe(true);
    });
  });

  it('wraps a Storage error as PhotoUploadError — never the raw provider error', async () => {
    fake.storageFailNextWith({ message: 'bucket unreachable' });
    await expect(uploadListingPhoto('owner-1', file('a.jpg', 'image/jpeg', 1024))).rejects.toBeInstanceOf(PhotoUploadError);
  });
});
