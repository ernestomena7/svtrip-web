// T007 + T008a (feature 022): the five content obligations, and FR-018's gap detector.
//
// EVERY CASE RUNS OVER THE REAL SHIPPED DOCUMENTS AND THE REAL RULES FILE, NOT FIXTURES. A fixture
// proves the checker works; these exist to prove what ships is well-formed. The sabotage ledger
// (T009) is what proves the checker works, by breaking a COPY and watching it redden.
//
// WHAT THIS CAN AND CANNOT DO, and the file says so rather than letting a green run imply more:
//
//   - C1..C5 compare STRUCTURE. They catch the failure that actually happens — one language edited
//     and the other forgotten. They CANNOT tell whether the Spanish and English say the same thing.
//     That is a human reading (T033), and no gate here pretends otherwise: this repo has recorded
//     the shape "a gate that reports success while verifying something weaker than it appears to"
//     in 008, 015, 016 and 018.
//
//   - The gap detector (FR-018) is the requirement `/speckit-analyze` found had NO task. The spec
//     says discipline alone does not hold — the inventory was three features stale precisely
//     because it relied on discipline — and a one-time re-measure is discipline. This makes the
//     table a TEST: a collection added to `firestore.rules` with no row in the data map fails.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  LEGAL_DOCUMENTS,
  getLegalDocument,
  compareDocuments,
} from '../src/legal/index.js';
import { DATA_MAP, NOT_PERSONAL, extractCollections } from '../src/legal/dataMap.js';
import type { LegalDocument } from '../src/legal/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(here, '../../firestore/firestore.rules'), 'utf8');

const IDS = ['privacy', 'terms'] as const;
const LANGS = ['es', 'en'] as const;

describe('C5 — the registry exposes exactly the four documents', () => {
  it('has privacy and terms, each in es and en, and nothing else', () => {
    // A fifth that nothing links to, or a missing one, both fail HERE rather than at a blank screen.
    expect(LEGAL_DOCUMENTS).toHaveLength(4);
    const keys = LEGAL_DOCUMENTS.map((d) => `${d.id}.${d.language}`).sort();
    expect(keys).toEqual(['privacy.en', 'privacy.es', 'terms.en', 'terms.es']);
  });

  it('resolves each by id and language', () => {
    for (const id of IDS) {
      for (const lang of LANGS) {
        expect(getLegalDocument(id, lang)?.language).toBe(lang);
      }
    }
  });
});

describe('C1 — both languages carry the same section ids, in the same order', () => {
  for (const id of IDS) {
    it(`${id}: es and en have identical section ids in identical order`, () => {
      const es = getLegalDocument(id, 'es')!;
      const en = getLegalDocument(id, 'en')!;
      expect(es.sections.map((s) => s.id)).toEqual(en.sections.map((s) => s.id));
    });
  }

  it('compareDocuments names the difference rather than only saying "unequal"', () => {
    // A checker that fails without saying WHICH section is a checker nobody trusts the second time.
    const a = fakeDoc('es', ['a', 'b', 'c']);
    const b = fakeDoc('en', ['a', 'c']);
    const diff = compareDocuments(a, b);
    expect(diff.length).toBeGreaterThan(0);
    expect(diff.join(' ')).toMatch(/\bb\b/);
  });

  it('catches a REORDER, not only an addition or removal', () => {
    // The two languages having the same SET of ids is not enough: a section moved on one side tells
    // a different story in a different order.
    const diff = compareDocuments(fakeDoc('es', ['a', 'b', 'c']), fakeDoc('en', ['a', 'c', 'b']));
    expect(diff.length).toBeGreaterThan(0);
  });

  it('is silent when the two are identical', () => {
    expect(compareDocuments(fakeDoc('es', ['a', 'b']), fakeDoc('en', ['a', 'b']))).toEqual([]);
  });
});

describe('C2 — both languages carry the same last-updated date', () => {
  for (const id of IDS) {
    it(`${id}: es and en share one updatedAt`, () => {
      // Two dates would let the Spanish say October and the English say August about the same
      // policy — telling a reader one side is stale without saying which.
      expect(getLegalDocument(id, 'es')!.updatedAt).toBe(getLegalDocument(id, 'en')!.updatedAt);
    });

    it(`${id}: the date is a real YYYY-MM-DD`, () => {
      const d = getLegalDocument(id, 'es')!.updatedAt;
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${d}T00:00:00Z`).getTime())).toBe(false);
    });
  }
});

describe('C3 — no section has an empty body', () => {
  for (const doc of LEGAL_DOCUMENTS) {
    it(`${doc.id}.${doc.language}: every section has at least one non-blank paragraph`, () => {
      for (const s of doc.sections) {
        expect(s.body.length, `${s.id} has no paragraphs`).toBeGreaterThan(0);
        for (const p of s.body) expect(p.trim().length, `${s.id} has a blank paragraph`).toBeGreaterThan(0);
        expect(s.heading.trim().length, `${s.id} has no heading`).toBeGreaterThan(0);
      }
    });
  }
});

describe('C4 — section ids are unique within a document', () => {
  for (const doc of LEGAL_DOCUMENTS) {
    it(`${doc.id}.${doc.language}: no id appears twice`, () => {
      // Otherwise C1 passes while a section is silently duplicated and another is missing.
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }
});

describe('FR-018 — the gap detector: every collection in the rules is accounted for', () => {
  const found = extractCollections(RULES);

  it('reads the rules file and finds the collections (the detector is not vacuous)', () => {
    // 15 roots and 9 subcollections when this was written. If the parser ever returns nothing, every
    // other case below passes trivially — the shape of vacuous pass 016, 018 and 020 each found.
    expect(found.length).toBeGreaterThanOrEqual(20);
    expect(found).toContain('reservations');
    expect(found).toContain('reviewReports');
  });

  it('every collection is either in the data map or in NOT_PERSONAL, with no gaps', () => {
    const mapped = new Set([...Object.keys(DATA_MAP), ...Object.keys(NOT_PERSONAL)]);
    const gaps = found.filter((c) => !mapped.has(c));
    // THE assertion. A collection added to firestore.rules without a row fails here, and the failure
    // names it — which is what 'FR-018: a new stored field shows up as a gap' means.
    expect(gaps, `collections with no row in dataMap.ts: ${gaps.join(', ')}`).toEqual([]);
  });

  it('nothing is in BOTH lists', () => {
    // A collection that is simultaneously "personal" and "not personal" is a contradiction the map
    // would otherwise resolve silently in whichever direction it was read.
    const both = Object.keys(DATA_MAP).filter((c) => c in NOT_PERSONAL);
    expect(both).toEqual([]);
  });

  it('every NOT_PERSONAL entry carries a reason', () => {
    // An allow-list with no reasons is a way to make the gate pass by adding to it.
    for (const [name, reason] of Object.entries(NOT_PERSONAL)) {
      expect(reason.trim().length, `${name} has no reason`).toBeGreaterThan(10);
    }
  });

  it('no stale entries: everything in the map still exists in the rules', () => {
    // The opposite failure: a collection removed from the rules but left in the map, so the policy
    // keeps disclosing something the product no longer stores.
    const all = new Set(found);
    const stale = [...Object.keys(DATA_MAP), ...Object.keys(NOT_PERSONAL)].filter((c) => !all.has(c));
    expect(stale, `in dataMap.ts but not in the rules: ${stale.join(', ')}`).toEqual([]);
  });

  it('every personal collection points at a policy section that EXISTS in both languages', () => {
    // The map is only a promise if its targets are real. A row naming a section that was renamed or
    // deleted passes the lists above and describes nothing.
    const privacyEs = new Set(getLegalDocument('privacy', 'es')!.sections.map((s) => s.id));
    const privacyEn = new Set(getLegalDocument('privacy', 'en')!.sections.map((s) => s.id));
    for (const [name, entry] of Object.entries(DATA_MAP)) {
      expect(privacyEs.has(entry.section), `${name} -> ${entry.section} missing in es`).toBe(true);
      expect(privacyEn.has(entry.section), `${name} -> ${entry.section} missing in en`).toBe(true);
    }
  });
});

describe('extractCollections — the parser, tested on its own', () => {
  it('finds roots and subcollections, and not the wildcard catch-all', () => {
    const rules = `
      match /databases/{database}/documents {
        match /users/{uid} {
          match /favorites/{placeId} { allow read: if true; }
        }
        match /reservations/{reservationId} { allow read: if true; }
        match /{document=**} { allow read, write: if false; }
      }`;
    expect(extractCollections(rules).sort()).toEqual(['favorites', 'reservations', 'users']);
  });

  it('ignores a match inside a comment', () => {
    const rules = `// match /ghost/{id} { }\n match /real/{id} { }`;
    expect(extractCollections(rules)).toEqual(['real']);
  });
});

function fakeDoc(language: 'es' | 'en', ids: string[]): LegalDocument {
  return {
    id: 'privacy',
    language,
    title: 't',
    updatedAt: '2026-10-19',
    sections: ids.map((id) => ({ id, heading: id, body: ['x'] })),
  };
}
