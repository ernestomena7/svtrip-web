// Opening hours (feature 007, T101 — FR-032).
//
// Seven rows on a desktop instead of the phone's stacked accordion: all week
// visible at once, which is how an owner actually checks that Sunday is right.
import { useTranslation } from 'react-i18next';
import type { OpeningHour } from '@svtrip/shared';
import { cx } from '../components/ui';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function defaultOpeningHours(): OpeningHour[] {
  return DAY_KEYS.map((_, day) => ({ day, open: '09:00', close: '17:00', closed: false }));
}

export function OpeningHoursEditor({
  hours,
  onChange,
}: {
  hours: OpeningHour[];
  onChange: (next: OpeningHour[]) => void;
}) {
  const { t } = useTranslation();

  function update(day: number, patch: Partial<OpeningHour>) {
    onChange(hours.map((h) => (h.day === day ? { ...h, ...patch } : h)));
  }

  return (
    <div className="space-y-2">
      {hours.map((hour) => (
        <div
          key={hour.day}
          className="flex flex-wrap items-center gap-3 rounded-md bg-surface-2 px-3.5 py-2.5"
        >
          <span className="w-24 text-sm font-bold text-text">
            {t(`days.${DAY_KEYS[hour.day]}`, DAY_KEYS[hour.day])}
          </span>

          <button
            type="button"
            onClick={() => update(hour.day, { closed: !hour.closed })}
            aria-pressed={!hour.closed}
            className={cx(
              'rounded-pill px-3 py-1 text-xs font-extrabold transition',
              hour.closed ? 'bg-surface text-muted' : 'bg-sunset text-white shadow-red',
            )}
          >
            {hour.closed ? t('services.closed') : t('services.open')}
          </button>

          {!hour.closed && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={hour.open}
                onChange={(e) => update(hour.day, { open: e.target.value })}
                aria-label={t('services.openTime')}
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary"
              />
              <span className="text-muted">—</span>
              <input
                type="time"
                value={hour.close}
                onChange={(e) => update(hour.day, { close: e.target.value })}
                aria-label={t('services.closeTime')}
                className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
