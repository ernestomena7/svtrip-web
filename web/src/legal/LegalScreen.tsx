// A legal document, on desktop (feature 022, US1 — FR-001, FR-002, FR-016, FR-017).
//
// The twin of `client/src/features/legal/LegalScreen.tsx`. The CONTENT and the language choice are
// not duplicated — both read the same typed documents from `shared/`, which is what keeps the two
// surfaces from disagreeing about what the policy says.
//
// **THE DOCUMENT SHIPS WITH THE APP AND IS NEVER FETCHED.** The spec asks that someone can read it
// without a network failing silently, and bundled content satisfies that by construction — a fetch
// would need a cache, a failure state and a story about staleness. If this screen ever shows a
// spinner, research R1's decision was reversed.
//
// It renders typed content in existing type styles: a `map` over sections and paragraphs. No Markdown
// renderer and no new dependency.
//
// Imports from `@svtrip/shared` ONLY — nothing here reaches `core/firebase`, so the suite that tests
// it loads with no mocks. That is feature 017's finding (a module whose import graph reaches Firebase
// takes tests with it) and feature 020's (143 -> 126 tests, vanished rather than failed).
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getLegalDocument } from '@svtrip/shared';
import type { LegalDocumentId } from '@svtrip/shared';

export function LegalScreen({ documentId }: { documentId: LegalDocumentId }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Spanish is the brand's primary language, so it is also the fallback for anything that is not
  // English — the same rule `useLocalized` applies to bilingual content elsewhere.
  const language = i18n.language?.startsWith('en') ? 'en' : 'es';
  const doc = getLegalDocument(documentId, language) ?? getLegalDocument(documentId, 'es');

  if (!doc) return <p className="p-4 text-sm text-muted">{t('legal.loadFailed')}</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <header className="flex items-center gap-3 border-b border-border pb-4 pt-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t('legal.back')}
          className="text-sm font-bold text-primary"
        >
          {t('legal.back')}
        </button>
        <h1 className="font-display text-lg font-extrabold text-text">{doc.title}</h1>
      </header>

      <div className="space-y-6 py-6">
        <p className="text-xs text-muted">
          {t('legal.updated')}: {doc.updatedAt}
        </p>
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="space-y-2">
            <h2 className="font-display text-base font-extrabold text-text">{section.heading}</h2>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed text-text">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
