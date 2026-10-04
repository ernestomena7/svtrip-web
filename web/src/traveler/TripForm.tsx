// Create or rename a Trip, desktop (US1, T030 — FR-001, FR-004).
//
// A separate component from the mobile one on purpose: the two surfaces have
// diverged since feature 007 and each carries its own primitives. What is NOT
// duplicated is the part that would drift silently — the ordering rule lives in
// `shared/` and the writes live in `core/`, so this file only renders.
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Trip, TripOrigin } from '@svtrip/shared';
import { toDateInput } from '@svtrip/shared';
import { Button, Card, Field, TextInput } from '../components/ui';
import { createTrip, updateTrip } from '@svtrip/core/repos/tripsRepo';
import { useAuth } from '@svtrip/core/auth/AuthProvider';

interface Props {
  trip?: Trip;
  origin?: TripOrigin;
  sourceMessageId?: string;
  onClose: () => void;
  onSaved: (tripId: string) => void;
  /**
   * Replaces the default create (feature 016, US3).
   *
   * The guide path needs the Trip AND its stops written together, and this form
   * is the only place that collects the name and start date a plan does not
   * carry (FR-037). Passing the creation in rather than teaching the form about
   * plans keeps `GeneratedPlan` out of a component that otherwise knows nothing
   * about the guide.
   */
  onCreate?: (input: { name: string; startDate: string }) => Promise<string>;
}

export function TripForm({ trip, origin, sourceMessageId, onClose, onSaved, onCreate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [name, setName] = useState(trip?.name ?? '');
  const [startDate, setStartDate] = useState(trip?.startDate ?? toDateInput(Date.now()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!name.trim()) return setError(t('trips.nameRequired'));
    if (!startDate) return setError(t('trips.startDateRequired'));
    setError(null);
    setSaving(true);
    try {
      if (trip) {
        await updateTrip(user.uid, trip.tripId, { name, startDate });
        onSaved(trip.tripId);
      } else {
        onSaved(
          onCreate
            ? await onCreate({ name: name.trim(), startDate })
            : await createTrip(user.uid, { name, startDate, origin, sourceMessageId }),
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <Card className="w-full max-w-md p-6">
        <form onSubmit={submit} className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-text">
            {trip ? t('trips.edit') : t('trips.create')}
          </h2>

          <Field label={t('trips.name')}>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('trips.namePlaceholder')}
              autoFocus
            />
          </Field>

          <Field label={t('trips.startDate')}>
            <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>

          {error && <p className="text-sm font-bold text-red">{error}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('trips.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {t('trips.save')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
