// Create / edit a promotion (feature 007, T106 — FR-035).
//
// The end date is mandatory and must be in the FUTURE. That is not input
// hygiene: a promotion with no end silently becomes a permanent price, and one
// that ends in the past is invisible the moment it is saved — an owner would
// publish it, see nothing on the Deals hub, and have no idea why. So the refusal
// says exactly that instead of failing quietly.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Deal } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { createDeal, updateDeal, type DealInput } from '@svtrip/core/repos/providerDealsRepo';
import { Button, Card, Field, TextInput } from '../components/ui';
import { BilingualField, fromLegacy } from './BilingualField';

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

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
  const [activeFrom, setActiveFrom] = useState(day(existing?.activeFrom ?? Date.now()));
  const [activeTo, setActiveTo] = useState(
    day(existing?.activeTo ?? Date.now() + 7 * 24 * 60 * 60 * 1000),
  );
  const [saving, setSaving] = useState(false);

  const from = new Date(activeFrom).getTime();
  const to = new Date(activeTo).getTime();
  const windowValid = Number.isFinite(from) && Number.isFinite(to) && from <= to;
  // Compared against the START of today, so a promotion running out this evening
  // is still savable rather than rejected as "past".
  const endsInFuture = to >= new Date().setHours(0, 0, 0, 0);
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
      activeFrom: from,
      activeTo: to,
    };
    try {
      if (existing) await updateDeal(existing.dealId, input);
      else await createDeal(user.uid, input);
      onClose();
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

      {!windowValid && (
        <p className="text-sm font-bold text-primary">{t('services.dealWindowInvalid')}</p>
      )}
      {windowValid && !endsInFuture && (
        <p className="text-sm font-bold text-primary">{t('services.dealEndPast')}</p>
      )}

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
