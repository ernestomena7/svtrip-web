// What still stands between this business and being public (feature 007, T105 — FR-036).
//
// THE THREE RULES THIS ENCODES ARE LOAD-BEARING. Break any one and the catalog
// empties, taking the AI Guide with it — the guide fails closed, so a business
// that stops being publicly visible stops being recommendable.
//
//   1. **Readiness is derived, never stored.** `isPublishable()` computes it
//      from the content in front of you. A stored status drifts from what it
//      describes the moment someone edits around it.
//   2. **The minimums are NOT retroactive.** 18 of the 19 catalog entries are
//      published today with zero photos. `contentVersion` (absent = predates
//      feature 006) exempts them until their first save. Enforcing the floor on
//      them would unpublish the entire catalog on deploy.
//   3. **The floor guards regression only.** An entry already below the bar
//      stays editable — otherwise its manager could not fix the very thing that
//      is missing, which is the one thing they are here to do.
//
// This component only *reports*. It never blocks a save on its own.
import { useTranslation } from 'react-i18next';
import { isLegacy, isPublishable, missingRequirements, type PublishableEntry } from '@svtrip/shared';
import { Icon } from '@svtrip/core/Icon';
import { Card } from '../components/ui';

export function PublicationChecklist({ entry }: { entry: PublishableEntry }) {
  const { t } = useTranslation();

  const legacy = isLegacy(entry);
  const missing = missingRequirements(entry);
  const ready = isPublishable(entry);

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center gap-2">
        <span className={ready ? 'text-primary' : 'text-muted'}>
          <Icon name={ready ? 'check' : 'clock'} size={18} />
        </span>
        <h3 className="font-display text-base font-extrabold text-text">
          {t('publication.title')}
        </h3>
      </div>

      {ready ? (
        <p className="text-sm text-muted">{t('publication.ready')}</p>
      ) : (
        <ul className="space-y-1.5">
          {missing.map((requirement) => (
            <li key={requirement} className="flex items-center gap-2 text-sm text-muted">
              <span className="text-border">
                <Icon name="minus" size={14} />
              </span>
              {t(`publication.missing.${requirement}`)}
            </li>
          ))}
        </ul>
      )}

      {legacy && <p className="text-xs text-muted">{t('publication.legacyNotice')}</p>}
    </Card>
  );
}
