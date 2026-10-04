// Create / edit a promotion (feature 007, T106 — FR-035).
//
// The end date is mandatory and must be in the FUTURE. That is not input
// hygiene: a promotion with no end silently becomes a permanent price, and one
// that ends in the past is invisible the moment it is saved — an owner would
// publish it, see nothing on the Deals hub, and have no idea why. So the refusal
// says exactly that instead of failing quietly.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '@svtrip/core/repos/useEntitlements';
import { Icon } from '@svtrip/core/Icon';
import type { Deal } from '@svtrip/shared';
// Local-time calendar arithmetic, shared with the mobile form. Parsing
// 'YYYY-MM-DD' with `new Date(v)` yields UTC midnight, which is six hours
// off local midnight here — enough to refuse a promotion ending today.
import { toDateInput, fromDateInput, startOfToday } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { createDeal, updateDeal, type DealInput } from '@svtrip/core/repos/providerDealsRepo';
import { Button, Card, Field, TextInput } from '../components/ui';
import { BilingualField, fromLegacy } from './BilingualField';


export function DealForm({
  listingId,
  existing,
  onClose,
}: {
  listingId: string;
  existing: Deal | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // FR-013. The ENTITLEMENT is the rule; the checkbox is only the
  // merchant's preference within it.
  const { entitlements } = useEntitlements();
  const canPublishToOfertas = entitlements.offersPublishing;
  // Defaults to ON for a Premium merchant: a promotion they bothered to write
  // is one they want seen. `!== false` so one written before this feature is
  // not retroactively opted out.
  const [inOfertas, setInOfertas] = useState(existing?.inOfertas !== false);
  const { user } = useAuth();

  const [titleI18n, setTitleI18n] = useState(() =>
    fromLegacy(existing?.title ?? '', existing?.titleI18n),
  );
  const [descriptionI18n, setDescriptionI18n] = useState(() =>
    fromLegacy(existing?.description ?? '', existing?.descriptionI18n),
  );
  const [amount, setAmount] = useState(existing ? String(existing.cost.amount) : '');
  const [original, setOriginal] = useState(
    existing?.cost.original ? String(existing.cost.original) : '',
  );
  const [activeFrom, setActiveFrom] = useState(toDateInput(existing?.activeFrom ?? Date.now()));
  const [activeTo, setActiveTo] = useState(
    toDateInput(existing?.activeTo ?? Date.now() + 7 * 24 * 60 * 60 * 1000),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const from = fromDateInput(activeFrom);
  const to = fromDateInput(activeTo);
  const windowValid = Number.isFinite(from) && Number.isFinite(to) && from <= to;
  // Compared against the START of today, so a promotion running out this evening
  // is still savable rather than rejected as "past".
  const endsInFuture = to >= startOfToday();
  const titled = Boolean(titleI18n.es.trim() && titleI18n.en.trim());
  const canSave = titled && windowValid && endsInFuture && !saving && Number(amount) >= 0;

  async function save() {
    if (!user || !canSave) return;
    setSaving(true);
    const input: DealInput = {
      listingId,
      title: titleI18n.es.trim(),
      description: descriptionI18n.es.trim(),
      titleI18n: { es: titleI18n.es.trim(), en: titleI18n.en.trim() },
      descriptionI18n: { es: descriptionI18n.es.trim(), en: descriptionI18n.en.trim() },
      cost: {
        amount: Number(amount) || 0,
        currency: 'USD',
        ...(original ? { original: Number(original) } : {}),
      },
      // Written only when the merchant may actually choose. On Básico the field
      // is left ABSENT rather than written `false`, so an upgrade to Premium
      // does not inherit an opt-out nobody made.
      ...(canPublishToOfertas ? { inOfertas } : {}),
      activeFrom: from,
      activeTo: to,
    };
    try {
      setSaveError(false);
      if (existing) await updateDeal(existing.dealId, input);
      else await createDeal(user.uid, input);
      onClose();
    } catch {
      // Without this the form closed nothing, stopped spinning and said
      // nothing — an owner reasonably reads that as saved.
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-5 p-6">
      <h2 className="font-display text-xl font-extrabold text-text">
        {existing ? t('services.editDeal') : t('services.newDeal')}
      </h2>

      <BilingualField
        label={t('services.dealTitle')}
        value={titleI18n}
        onChange={setTitleI18n}
        placeholder={t('services.dealTitlePlaceholder')}
      />
      <BilingualField
        label={t('services.description')}
        value={descriptionI18n}
        onChange={setDescriptionI18n}
        multiline
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t('services.dealPrice')}>
          <TextInput
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="25"
          />
        </Field>
        <Field label={t('services.dealOriginal')}>
          <TextInput
            inputMode="decimal"
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder="50"
          />
        </Field>
        <Field label={t('services.dealFrom')}>
          <TextInput type="date" value={activeFrom} onChange={(e) => setActiveFrom(e.target.value)} />
        </Field>
        <Field label={t('services.dealTo')}>
          <TextInput type="date" value={activeTo} onChange={(e) => setActiveTo(e.target.value)} />
        </Field>
      </div>

      {/* FR-013 + US2 scenario 2: PRESENT AND REFUSING, never absent. The
          reverse of feature 010's rule, where the admin link is hidden from
          anyone without the claim because a control existing only to refuse you
          advertises a screen that is none of your business. Here the opposite
          holds: the merchant is MEANT to know Premium exists. */}
      {canPublishToOfertas ? (
        <label className="flex items-start gap-3 rounded-md bg-surface-2 p-4">
          <input
            type="checkbox"
            checked={inOfertas}
            onChange={(e) => setInOfertas(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            <span className="block text-sm font-bold text-text">
              {t('services.dealInOfertas')}
            </span>
            <span className="block text-xs text-muted">{t('services.dealInOfertasHint')}</span>
          </span>
        </label>
      ) : (
        <div className="rounded-md bg-surface-2 p-4">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 text-accent">
              <Icon name="sparkles" size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-text">{t('subscription.offersLocked')}</p>
              <p className="mt-0.5 text-xs text-muted">{t('subscription.offersLockedHint')}</p>
            </div>
          </div>
        </div>
      )}

      {!windowValid && (
        <p className="text-sm font-bold text-primary">{t('services.dealWindowInvalid')}</p>
      )}
      {windowValid && !endsInFuture && (
        <p className="text-sm font-bold text-primary">{t('services.dealEndPast')}</p>
      )}
      {saveError && <p className="text-sm font-bold text-primary">{t('common.saveFailed')}</p>}

      <div className="flex gap-2">
        <Button iconLeft="check" disabled={!canSave} onClick={() => void save()}>
          {saving ? t('common.loading') : t('services.save')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </Card>
  );
}
