// Catalog search (feature 014, US2).
//
// The first describe block is the one that matters. Everything else here guards
// scope; that one guards against a failure mode this product is uniquely exposed
// to, and it is the reason `matchesQuery` takes a resolver at all.
import { describe, it, expect } from 'vitest';
import { matchesQuery, searchableText, normalize, type LabelResolver } from '../src/search.js';

// How the real catalog stores things: tags are ENGLISH KEYS, keywords are free
// Spanish text. Copied from `server/src/data/seedCatalog.ts` rather than
// invented, because the whole point is what the real shapes are.
const tunco = {
  name: 'El Tunco',
  categories: ['beach', 'surf', 'nightlife'],
  moods: ['beach', 'nightlife', 'extreme-adventure'],
  keywords: ['el tunco', 'tunco', 'surf', 'playa tunco'],
};

const santaAna = {
  name: 'Santa Ana Volcano (Ilamatepec)',
  categories: ['volcano', 'hiking', 'nature'],
  moods: ['extreme-adventure', 'hiking'],
  keywords: ['santa ana', 'ilamatepec', 'volcano', 'volcan', 'crater'],
};

const cafe = {
  name: 'Café del Cerro',
  categories: ['coffee'],
  moods: ['relax'],
  keywords: [],
};

/** Stands in for i18next: the same mapping the locale files already carry. */
const resolve: LabelResolver = (_kind, key) =>
  ({
    beach: 'Playa',
    nightlife: 'Vida nocturna',
    'extreme-adventure': 'Aventura extrema',
    hiking: 'Senderismo',
    volcano: 'Volcán',
    nature: 'Naturaleza',
    surf: 'Surf',
    relax: 'Relax',
    coffee: 'Café',
  })[key] ?? key;

// A beach whose keywords do NOT happen to contain the word "playa".
//
// This entry exists because of a mistake worth keeping visible: the first
// version of this suite used El Tunco, whose keywords include "playa tunco" —
// so it was findable by "playa" through a keyword even with label resolution
// removed. The headline test passed for the wrong reason, and only sabotaging
// the resolver revealed it. Most beaches in the catalog are this shape, not
// El Tunco's.
const zonte = {
  name: 'El Zonte',
  categories: ['beach', 'surf'],
  moods: ['beach'],
  keywords: ['zonte', 'bitcoin beach'],
};

describe('tags are matched on their LABEL, never on the stored key', () => {
  it('finds a beach when a traveler types "playa", with no keyword to lean on', () => {
    // THE test. The catalog stores `beach`; a Salvadoran types "playa". Match
    // the raw key and this returns false — which is how a Spanish-primary
    // product ends up where "beach" works and "playa" does not.
    expect(matchesQuery(zonte, 'playa', resolve)).toBe(true);
  });

  it('proves the keyword is not what is doing the work', () => {
    // Same entry, same query, with the resolver disabled. If this were ever
    // true, the test above would be meaningless.
    const noResolve: LabelResolver = (_kind, key) => key;
    expect(matchesQuery(zonte, 'playa', noResolve)).toBe(false);
  });

  it('finds a volcano when a traveler types "volcán"', () => {
    expect(matchesQuery(santaAna, 'volcán', resolve)).toBe(true);
  });

  it('does not match a place whose labels have nothing to do with the query', () => {
    expect(matchesQuery(santaAna, 'playa', resolve)).toBe(false);
  });
});

describe('accents and case', () => {
  it('finds "volcán" when typing "volcan"', () => {
    expect(matchesQuery(santaAna, 'volcan', resolve)).toBe(true);
  });

  it('finds "Café" when typing "cafe" — via the NAME', () => {
    expect(matchesQuery(cafe, 'cafe', resolve)).toBe(true);
  });

  it('finds "Café" when typing "cafe" — via a resolved TAG, not only the name', () => {
    // Normalisation has to cover every searched field, not just the one that is
    // easy to remember. `coffee` resolves to "Café"; the query is unaccented.
    expect(matchesQuery({ ...cafe, name: 'Rincón' }, 'cafe', resolve)).toBe(true);
  });

  it('ignores case in both directions', () => {
    expect(matchesQuery(tunco, 'EL TUNCO', resolve)).toBe(true);
  });
});

describe('what is searched, and what is not', () => {
  it('covers name, keywords and resolved tags', () => {
    const text = searchableText(tunco, resolve).join(' | ');
    expect(text).toContain('el tunco'); // name
    expect(text).toContain('playa tunco'); // keyword
    expect(text).toContain('playa'); // resolved mood label
    expect(text).toContain('vida nocturna'); // resolved category label
  });

  it('does NOT search the long description', () => {
    // Pinned as a SET rather than inferred from which queries happen to match,
    // because "we also search the description now" is exactly the kind of scope
    // creep that slips in unnoticed and makes results unexplainable.
    const withDescription = { ...cafe, description: 'una terraza escondida en la montaña' } as never;
    expect(matchesQuery(withDescription, 'terraza', resolve)).toBe(false);
  });

  it('matches the displayed name when one is supplied, for bilingual listings', () => {
    expect(matchesQuery({ ...cafe, name: 'Hill Coffee' }, 'cerro', resolve, 'Café del Cerro')).toBe(
      true,
    );
  });

  it('still matches the stored name when a displayed name is supplied', () => {
    expect(matchesQuery({ ...cafe, name: 'Hill Coffee' }, 'hill', resolve, 'Café del Cerro')).toBe(
      true,
    );
  });
});

describe('an empty query', () => {
  it('matches everything, so clearing the field restores the catalog', () => {
    expect(matchesQuery(tunco, '', resolve)).toBe(true);
    expect(matchesQuery(tunco, '   ', resolve)).toBe(true);
  });
});

describe('normalize', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalize('Volcán DE Santa Ana')).toBe('volcan de santa ana');
  });
});
