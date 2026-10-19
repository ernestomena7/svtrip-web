// The two links and the app version, on desktop (feature 022, FR-011/FR-012).
//
// The twin of `client/src/features/legal/LegalLinks.tsx`.
//
// DISCREET IS A REQUIREMENT, AND IT HAS AN OBVIOUS FAILURE MODE. The request asked for it and the
// reason is sound — these are documents someone looks for deliberately, not controls competing with
// the ones above. But "discreet" implemented as 10px grey on cream satisfies the word and defeats the
// purpose. The test is whether somebody LOOKING for it finds it: small, muted, below everything else,
// and still a legible size with a real tap target.
//
// The version is `__APP_VERSION__`, INJECTED at build time from `android/app/build.gradle`'s
// `versionName` on the phone; on desktop it is the workspace's own package.json (it has no native shell). The fallback is
// `'dev'`, never a plausible number: a version that is silently right in the repository and wrong on
// the device is worse than none.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { resolveAppVersion } from '@svtrip/shared';

export function LegalLinks() {
  const { t } = useTranslation();
  const version = resolveAppVersion(typeof __APP_VERSION__ === 'undefined' ? undefined : __APP_VERSION__);

  return (
    <footer className="space-y-1 pb-2 pt-8 text-left">
      <nav className="flex items-center justify-start gap-4 text-sm text-muted">
        {/* `min-h-[44px]`: small TEXT, normal TAP TARGET. Discreet must not mean hard to hit. */}
        <Link to="/privacidad" className="inline-flex min-h-[44px] items-center underline underline-offset-2">
          {t('legal.privacy')}
        </Link>
        <Link to="/terminos" className="inline-flex min-h-[44px] items-center underline underline-offset-2">
          {t('legal.terms')}
        </Link>
      </nav>
      <p className="text-sm text-muted" data-testid="app-version">
        {t('legal.version')} {version}
      </p>
    </footer>
  );
}
