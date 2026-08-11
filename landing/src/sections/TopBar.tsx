// Landing top bar.
//
// The glass treatment from `ui_kits/web/WebNav.jsx` — sticky, blurred, hairline
// bottom border — but without the application's search field, saved-items button
// or avatar: none of them mean anything to a visitor with no account. What is
// left is the wordmark, the language switch and the one action this page exists
// to offer.
import { useTranslation } from 'react-i18next';
import { ButtonLink } from '../components/Button';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { APP_SIGN_IN_URL } from '../config';

// Served from `public/`, referenced by URL rather than imported: `prerender.ts`
// runs in Node, and Node cannot load a `.png` import — only the bundler can.
const WORDMARK = '/svtrip-wordmark.png';

export function TopBar() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3 md:px-10">
        <a href="#top" className="flex items-center">
          <img src={WORDMARK} alt="SVTrip" className="h-9 w-auto" />
        </a>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          <LanguageSwitch />
          <ButtonLink href={APP_SIGN_IN_URL}>{t('landing.nav.signIn')}</ButtonLink>
        </div>
      </div>
    </header>
  );
}
