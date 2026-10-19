/**
 * The shape of the legal documents (feature 022) — see contracts/documents.md §1.
 *
 * **`LegalSection.id` is language-independent on purpose.** The Spanish heading and the English
 * heading differ; the id does not. That is the ONLY thing a gate can compare across the two
 * versions, because the prose lives outside the locale files — and it lives there deliberately:
 * `check:brand` counts flattened locale keys (774 before this feature) and fifteen feature records
 * read that number as "UI strings this feature added". Sixty to a hundred and twenty paragraphs of
 * legal text would make every later delta unreadable.
 *
 * The price, stated rather than hidden: the ES/EN parity gate no longer reaches the largest
 * user-facing text in the product, and the structural check that replaces it can compare SECTIONS
 * and nothing more. **It cannot tell whether a translation is faithful.** Nothing automated can.
 */

export type LegalDocumentId = 'privacy' | 'terms';
export type LegalLanguage = 'es' | 'en';

export interface LegalSection {
  /** Stable and language-independent: `data-collected`, `third-parties`, `retention`. */
  id: string;
  heading: string;
  /** Paragraphs. Never empty — a heading with nothing under it reads as a deleted section. */
  body: string[];
  /**
   * Where each claim in this section comes from, so the next editor can check it against the
   * code instead of trusting it. A policy is only as true as its source.
   */
  source?: string;
}

export interface LegalDocument {
  id: LegalDocumentId;
  language: LegalLanguage;
  title: string;
  /** `YYYY-MM-DD`. SHARED by both languages of one document — two dates tell a reader one side is stale without saying which. */
  updatedAt: string;
  sections: LegalSection[];
}
