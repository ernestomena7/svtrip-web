// @vitest-environment jsdom
//
// Offline reading (feature 023, FR-019 / T055b): what Firestore's on-device cache gave for free.
//
// The cases that carry this file are the two LIMITS, not the happy path: the cache never invents a
// value (a first visit with no network still shows the screen's error state), and signing out takes
// the cached private data with it (otherwise the next person on the phone reads it).
import { describe, it, expect, beforeEach } from 'vitest';
import { forgetAll, readThrough, recall, remember } from '../src/db/offlineCache';

beforeEach(() => {
  localStorage.clear();
});

const offline = () => Promise.reject(Object.assign(new Error('Failed to fetch'), { name: 'TypeError' }));

describe('readThrough', () => {
  it('returns the network result and remembers it', async () => {
    expect(await readThrough('trips:alice', async () => ['t1'])).toEqual(['t1']);
    expect(recall('trips:alice')).toEqual(['t1']);
  });

  it('serves the last result when the network read fails', async () => {
    await readThrough('trips:alice', async () => ['t1']);
    expect(await readThrough('trips:alice', offline)).toEqual(['t1']);
  });

  it('with NOTHING cached, rethrows — the screen shows its own error state, never invented data', async () => {
    await expect(readThrough('trips:alice', offline)).rejects.toThrow('Failed to fetch');
  });

  it('keeps one account’s data under its own key', async () => {
    await readThrough('trips:alice', async () => ['alice-trip']);
    await expect(readThrough('trips:bob', offline)).rejects.toThrow();
  });
});

describe('forgetAll (sign-out)', () => {
  it('removes every cached entry, and nothing that is not the cache’s', () => {
    remember('trips:alice', ['t1']);
    remember('conversations:alice', ['c1']);
    localStorage.setItem('svtrip-ui-language', 'es');
    forgetAll();
    expect(recall('trips:alice')).toBeUndefined();
    expect(recall('conversations:alice')).toBeUndefined();
    expect(localStorage.getItem('svtrip-ui-language')).toBe('es');
  });
});

describe('a broken store degrades to "no cache", never to a crash', () => {
  it('survives a quota error on write', async () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    try {
      expect(await readThrough('k', async () => [1])).toEqual([1]);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
