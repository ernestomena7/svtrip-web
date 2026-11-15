// The header every signed-out page shares: the wordmark and the two ways in.
//
// EXTRACTED from PreviewScreen at feature 024, when a second signed-out page (the public place
// profile) needed the same bar — copying it would have put two parallel versions of one control on
// the product (Principle VI). `next` returns the visitor to the page they were on after signing in.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

const WORDMARK = '/svtrip-wordmark.png';

export function PublicHeader({ next }: { next?: string }) {
  const { t } = useTranslation();
  const q = next ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center px-5 md:px-10">
        <img src={WORDMARK} alt="SVTrip" className="h-9 w-auto" />
        <div className="ml-auto flex items-center gap-2">
          <Link to={`/register${q}`}>
            <Button variant="secondary">{t('web.preview.register')}</Button>
          </Link>
          <Link to={`/sign-in${q}`}>
            <Button>{t('web.preview.cta')}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
