// The merchant's "Recibir reservas" switch (feature 020, US1 — FR-001..FR-005).
//
// Three things this control has to get right, and each of them is a requirement
// rather than a nicety:
//
//   FR-001  It starts OFF. `reservationsEnabled === true`, never `!== false` —
//           all 33 live listings carry no such field, and reading absence as ON
//           would turn reservations on for every place in the catalog, none of
//           which has opening hours. This is the MIRROR of 018's `covered`
//           default, not a copy of it.
//
//   FR-002  Turning it on without usable hours is refused WITH THE REASON and a
//           way through to the editor. A bare failure here would be feature
//           010's defect verbatim: that feature shipped fully built and returned
//           an empty picker, because a silent `permission-denied` looks exactly
//           like nothing being wrong.
//
//   FR-002a Emptying the hours later turns reservations off and SAYS SO. The
//           switch must never read ON while every request is refused.
//
// It is never filtered by `businessType` (research R2). The obvious optimisation
// — offer it only to restaurants, bars and lodging — would hide the feature from
// *Apaneca Zipline Adventures* and *Bamboards Surf Academy*, which are sorted as
// `outdoor-activity` and are exactly the businesses that take bookings. The
// merchant knows their business better than the taxonomy does.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { hasUsableHours } from '@svtrip/shared';
import type { OpeningHour } from '@svtrip/shared';
import { setReservationsEnabled } from '@svtrip/core/apiClient';
import { Button, Card } from '../components/ui';
import { Icon } from '@svtrip/core/Icon';

export function ReservationsToggle({
  listingId,
  enabled,
  openingHours,
  onChanged,
  onGoToHours,
}: {
  listingId: string;
  /** Absent means OFF. Read `=== true`, never `!== false`. */
  enabled: boolean | undefined;
  openingHours: OpeningHour[] | undefined;
  onChanged: (enabled: boolean) => void;
  /** FR-002's "a way to fill them" — the editor already exists on this screen. */
  onGoToHours?: () => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOn = enabled === true;
  const canEnable = hasUsableHours(openingHours);

  async function flip() {
    const next = !isOn;
    setSaving(true);
    setError(null);
    try {
      await setReservationsEnabled(listingId, next);
      onChanged(next);
    } catch (err) {
      // The reason is named, not swallowed. `hours_unusable` is the one a
      // merchant can act on, and it gets its own message plus the way through.
      const code = (err as { code?: string }).code;
      setError(code === 'hours_unusable' ? 'needsHours' : 'failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-bold">{t('reservations.merchant.toggle')}</p>
          <p className="text-xs text-muted">
            {isOn ? t('reservations.merchant.toggleOn') : t('reservations.merchant.toggleOff')}
          </p>
        </div>
        <Button
          variant={isOn ? 'secondary' : 'primary'}
          size="sm"
          onClick={flip}
          disabled={saving || (!isOn && !canEnable)}
          aria-pressed={isOn}
          aria-label={t('reservations.merchant.toggle')}
        >
          {isOn ? t('reservations.merchant.turnOff') : t('reservations.merchant.turnOn')}
        </Button>
      </div>

      {/* Stated BEFORE the merchant taps, not only after a refusal. A control
          that explains itself only by failing is a control that has already
          wasted the tap. */}
      {!isOn && !canEnable && (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3">
          <p className="text-xs text-muted">{t('reservations.merchant.needsHours')}</p>
          {onGoToHours && (
            <Button variant="ghost" size="sm" onClick={onGoToHours} iconLeft="clock">
              {t('reservations.merchant.needsHoursCta')}
            </Button>
          )}
        </div>
      )}

      {error === 'needsHours' && (
        <p className="flex items-start gap-2 text-xs text-muted">
          <Icon name="clock" size={14} />
          {t('reservations.merchant.needsHours')}
        </p>
      )}
      {error === 'failed' && (
        <p className="text-xs text-muted">{t('reservations.merchant.toggleFailed')}</p>
      )}
    </Card>
  );
}
