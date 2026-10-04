// The taxonomy icon fallback chain (feature 014, US4).
//
// Three links, and the middle one is the whole reason this file exists:
//
//   1. the icon a super admin assigned
//   2. the built-in map — heart, compass, utensils, music, waves, home,
//      mountain, camera
//   3. `person_check`, the default for moods
//
// The instruction was to leave the eight built-in moods' icon field EMPTY and
// fill them in by hand later. Empty resolves to the default, so dropping link 2
// puts `person_check` on all eight tiles of the redesign's signature grid — a
// visible regression on the one screen the feature exists to improve, shipped
// while every other test stays green.
import { describe, it, expect } from 'vitest';
import {
  resolveEntryIcon,
  moodIcon,
  MOOD_ICON,
  DEFAULT_TAXONOMY_ICON,
} from '../src/moodIcons.js';

const assigned = { icon: 'directions_run', iconCodepoint: 'e566' };

describe('link 1 — an icon a super admin assigned', () => {
  it('wins over everything else', () => {
    // `beach` HAS a built-in icon. The assignment must still take precedence,
    // or assigning one to a built-in mood would silently do nothing.
    const r = resolveEntryIcon('moods', 'beach', assigned);
    expect(r).toEqual({ kind: 'assigned', codepoint: 'e566' });
  });

  it('is ignored when the codepoint is missing', () => {
    // A name with no codepoint cannot be drawn — the renderer takes codepoints
    // and the phone carries no name map. Falling through beats a blank box.
    const r = resolveEntryIcon('moods', 'beach', { icon: 'directions_run' });
    expect(r.kind).toBe('builtIn');
  });
});

describe('link 2 — the built-in map, which must NOT be dropped', () => {
  /**
   * The expected pairs, written out.
   *
   * This used to iterate `MOOD_ICON` and compare each entry against
   * `MOOD_ICON` — so changing an icon changed the expectation with it, and
   * the test could only ever prove that the resolver reads the map. Which
   * icon each mood carries is a brand decision; changing one should turn a
   * test red and be a deliberate act, not a silent edit.
   */
  const EXPECTED: Record<string, string> = {
    'romantic-date': 'heart',
    'extreme-adventure': 'navigation',
    'local-food': 'utensils',
    nightlife: 'music',
    beach: 'waves',
    'colonial-town': 'home',
    hiking: 'mountain',
    culture: 'camera',
  };

  it.each(Object.entries(EXPECTED))(
    'keeps %s on its existing brand icon when nothing is assigned',
    (key, name) => {
      expect(resolveEntryIcon('moods', key)).toEqual({ kind: 'builtIn', name });
    },
  );

  it('expects every mood the map declares, and no others', () => {
    // Keeps the two lists honest: a mood added to MOOD_ICON without a line
    // above would otherwise go untested.
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(MOOD_ICON).sort());
  });

  it('covers all eight built-in moods, so none can quietly fall to the default', () => {
    const resolved = Object.keys(MOOD_ICON).map((k) => resolveEntryIcon('moods', k).kind);
    expect(resolved).toHaveLength(8);
    expect(resolved.every((k) => k === 'builtIn')).toBe(true);
  });

  it('does not apply to the other two vocabularies, which never had a map', () => {
    expect(resolveEntryIcon('business-types', 'restaurant-cafe').kind).toBe('default');
  });
});

describe('link 3 — the per-vocabulary default', () => {
  it('gives an admin-created mood with no icon `person_check`', () => {
    const r = resolveEntryIcon('moods', 'sunset-run');
    expect(r).toEqual({ kind: 'default', codepoint: DEFAULT_TAXONOMY_ICON.moods.codepoint });
  });

  it('does not reuse the mood default on a business type', () => {
    // FR-041. `person_check` says something about a mood and nothing about a
    // shop, so one global default would be worse than none.
    const bt = resolveEntryIcon('business-types', 'anything').codepoint;
    expect(bt).not.toBe(DEFAULT_TAXONOMY_ICON.moods.codepoint);
  });

  it('gives every vocabulary a real, distinct default', () => {
    const points = Object.values(DEFAULT_TAXONOMY_ICON).map((d) => d.codepoint);
    expect(new Set(points).size).toBe(3);
    expect(points.every((p) => /^[0-9a-f]{4,6}$/.test(p))).toBe(true);
  });
});

describe('resolution never returns nothing', () => {
  it.each([
    ['moods', 'beach', undefined],
    ['moods', 'invented-by-an-admin', undefined],
    ['moods', 'beach', assigned],
    ['business-types', 'anything', undefined],
    ['services', 'anything', undefined],
  ] as const)('%s / %s always resolves to something drawable', (vocab, key, entry) => {
    const r = resolveEntryIcon(vocab, key, entry);
    expect('codepoint' in r ? r.codepoint : r.name).toBeTruthy();
  });
});

describe('moodIcon, the older helper the line-icon call sites still use', () => {
  it('returns the built-in icon for a built-in mood', () => {
    expect(moodIcon('beach')).toBe('waves');
  });

  it('falls back rather than returning undefined for an admin-created mood', () => {
    // Reaching `<Icon name={undefined}>` is the failure feature 010 introduced
    // this helper to prevent.
    expect(moodIcon('sunset-run')).toBe('star');
  });
});

// --- feature 015 follow-up: a plain lookup reaches the prototype ------------

describe('an admin-created key cannot borrow from Object.prototype', () => {
  // Moods stopped being a closed set in feature 010: a super admin types the
  // key. `MOOD_ICON[key]` on a plain object resolves inherited properties too,
  // so a mood keyed `constructor` returned a FUNCTION where an icon name was
  // expected — reaching `<Icon name={...}>` as exactly the value the `?? 'star'`
  // fallback exists to prevent, because `??` only catches null and undefined.
  it('falls back for keys that exist on every object', () => {
    for (const key of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(moodIcon(key)).toBe('star');
    }
  });

  it('still falls back for an ordinary unknown key', () => {
    expect(moodIcon('mood-que-no-existe')).toBe('star');
  });

  it('still resolves a real built-in mood', () => {
    expect(moodIcon('romantic-date')).toBe('heart');
  });
});
