/**
 * The legal documents and their structural check (feature 022, contracts/documents.md).
 *
 * Four modules — privacy and terms, each in Spanish and English — bundled with the app, so they
 * render with no network and are never fetched. `shared/` rather than `core/` by feature 016's
 * extension of the standing rule: what both client surfaces must agree on belongs here, and `core/`
 * carries React and the Firebase Web SDK, neither of which a list of paragraphs needs.
 */
import type { LegalDocument, LegalDocumentId, LegalLanguage } from './types.js';
import { privacyEs } from './privacy.es.js';
import { privacyEn } from './privacy.en.js';
import { termsEs } from './terms.es.js';
import { termsEn } from './terms.en.js';

export type { LegalDocument, LegalSection, LegalDocumentId, LegalLanguage } from './types.js';

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [privacyEs, privacyEn, termsEs, termsEn];

/**
 * The versions a merchant accepts at registration (feature 025, R12): each document's `updatedAt`.
 * The Spanish and English texts share it (enforced by `compareDocuments`), so either language answers.
 */
export function currentLegalVersions(): { terms: string; privacy: string } {
  const of = (id: LegalDocumentId) => LEGAL_DOCUMENTS.find((d) => d.id === id)!.updatedAt;
  return { terms: of('terms'), privacy: of('privacy') };
}

export function getLegalDocument(
  id: LegalDocumentId,
  language: LegalLanguage,
): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((d) => d.id === id && d.language === language);
}

/**
 * The structural differences between two versions of one document; empty means they carry the same
 * section ids in the same order. (A semicolon, not a period: `check:boundaries` matches the text
 * `document` + `.` anywhere in `shared/`, comments included, as a DOM access.)
 *
 * **Structure only, and it says so in its name.** It cannot tell whether the Spanish and English say
 * the same thing — nothing automated can, and a function that implied otherwise would be the exact
 * shape of defect this repository keeps recording: green while verifying less than it appears to.
 *
 * Returns messages naming WHICH section, because a checker that fails without saying where is a
 * checker nobody trusts the second time.
 */
export function compareDocuments(a: LegalDocument, b: LegalDocument): string[] {
  const out: string[] = [];
  const ai = a.sections.map((s) => s.id);
  const bi = b.sections.map((s) => s.id);

  for (const id of ai) if (!bi.includes(id)) out.push(`section "${id}" is in ${a.language} but not ${b.language}`);
  for (const id of bi) if (!ai.includes(id)) out.push(`section "${id}" is in ${b.language} but not ${a.language}`);

  // Same SET is not enough: a section moved on one side tells a different story in a different
  // order, so the ORDER of the ids both versions share must match too.
  const shared = ai.filter((id) => bi.includes(id));
  const sharedB = bi.filter((id) => ai.includes(id));
  if (shared.join('|') !== sharedB.join('|')) {
    out.push(`sections are in a different order: [${shared.join(', ')}] vs [${sharedB.join(', ')}]`);
  }
  if (a.updatedAt !== b.updatedAt) {
    out.push(`updatedAt differs: ${a.updatedAt} (${a.language}) vs ${b.updatedAt} (${b.language})`);
  }
  return out;
}
