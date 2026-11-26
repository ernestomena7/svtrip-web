// Feature 025 (FR-008, FR-019): what a completed registration tells the merchant — truthfully.
//
//   promotion   → "your Premium free period ends on {date}" (the El Salvador calendar date)
//   visible     → in the catalog already (an existing plan covers it)
//   hidden      → saved, NOT visible until a plan is chosen — never "you are live" (FR-008)
//   registered  → a return visit after a reload: the record says whether a promotion applied, and the
//                 page does not claim more than that
//
// "Ir a mi negocio" opens the merchant's places; the session is already here (research R1).
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui';

export type ConfirmationKind = 'promotion' | 'visible' | 'hidden' | 'registered';

export function formatLocalDate(isoDate: string, lang: 'es' | 'en'): string {
  // `isoDate` is already an El Salvador calendar date (YYYY-MM-DD); format it as that date, in UTC, so
  // the viewer's own time zone cannot move it by a day.
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-SV', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

export function SignupConfirmation({ kind, freeUntilLocal, lang }: { kind: ConfirmationKind; freeUntilLocal?: string; lang: 'es' | 'en' }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5" data-testid={`signup-confirmation-${kind}`}>
      {kind === 'promotion' && freeUntilLocal && (
        <p className="rounded-md bg-surface-2 p-4 text-[15px] text-text">
          {t('signup.done.promotion', { date: formatLocalDate(freeUntilLocal, lang) })}
        </p>
      )}
      {kind === 'visible' && <p className="text-[15px] text-text">{t('signup.done.visible')}</p>}
      {kind === 'hidden' && <p className="rounded-md bg-surface-2 p-4 text-[15px] text-text">{t('signup.done.hidden')}</p>}
      {kind === 'registered' && <p className="text-[15px] text-text">{t('signup.done.registered')}</p>}

      <div className="flex flex-col gap-3">
        {kind === 'hidden' && (
          <Link to="/subscription">
            <Button fullWidth size="lg">
              {t('signup.done.choosePlan')}
            </Button>
          </Link>
        )}
        <Link to="/businesses">
          <Button fullWidth size="lg" variant={kind === 'hidden' ? 'secondary' : 'primary'}>
            {t('signup.done.goToBusiness')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
