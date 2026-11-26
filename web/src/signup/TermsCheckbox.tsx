// Feature 025 (FR-012): "Acepto los Términos y la Política de privacidad", both linked.
//
// Shared by Step 1 (new accounts) and Step 2 (an existing or Google account that has not accepted the
// current versions — R12a), so the wording exists once.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md bg-surface-2 p-3.5 text-sm text-text">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid="signup-terms"
      />
      <span>
        {t('signup.terms.accept')}{' '}
        <Link to="/terminos" target="_blank" className="font-bold underline underline-offset-2">
          {t('legal.terms')}
        </Link>{' '}
        {t('signup.terms.and')}{' '}
        <Link to="/privacidad" target="_blank" className="font-bold underline underline-offset-2">
          {t('legal.privacy')}
        </Link>
      </span>
    </label>
  );
}
