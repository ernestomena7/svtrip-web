// Footer (feature 007, T048).
//
// The navy footer from `ui_kits/web/WebApp.jsx`: wordmark on the left, the
// brand's own sign-off on the right. The language switch repeats here because a
// visitor who read to the bottom in the wrong language should not have to scroll
// back up to fix it.
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '../components/LanguageSwitch';

// Served from `public/`, referenced by URL rather than imported: `prerender.ts`
// runs in Node, and Node cannot load a `.png` import — only the bundler can.
const WORDMARK = '/svtrip-wordmark.png';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-dusk text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-10">
        <img src={WORDMARK} alt="SVTrip" className="h-10 w-auto self-start" />
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
          <span className="text-[13px] font-bold">{t('landing.footer.tagline')}</span>
          <LanguageSwitch tone="dark" />
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-5 py-4 text-[12px] text-white/50 md:px-10">
          © {year} SVTrip. {t('landing.footer.rights')}
        </p>
      </div>
    </footer>
  );
}
