// One unseen place, offered alongside the plan — desktop surface (feature 013,
// T023 — FR-012).
//
// **An invitation, not a stop**, and the visual distinction is the requirement.
// Duplicated per surface rather than shared, following the precedent already set
// by the location picker (008 R1), the mood editors (009) and the clarify chips
// (012): the rules live once in `shared/`, the presentation belongs to each
// surface's own idiom.
import { useTranslation } from 'react-i18next';
import type { Introduction } from '@svtrip/shared';
import { Icon } from '@svtrip/core/Icon';
import { cx } from '../components/ui';

export function IntroductionCard({
  introduction,
  name,
  onOpen,
}: {
  introduction: Introduction;
  name: string;
  onOpen: (catalogId: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => onOpen(introduction.catalogId)}
      className={cx(
        'mt-4 flex w-full items-start gap-3 rounded-lg border border-dashed border-border',
        'bg-transparent px-4 py-3 text-left transition hover:bg-surface-2',
      )}
    >
      <Icon name="sparkles" size={18} className="mt-0.5 shrink-0 text-primary" />
      <span className="flex flex-col gap-0.5">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">
          {t('guide.introduce.heading')}
        </span>
        <span className="font-display font-extrabold text-text">{name}</span>
        {/* Resolved here, not on the server: a stored reply renders in the
            language the traveler is using now. */}
        <span className="text-sm text-muted">{t(introduction.copyKey)}</span>
      </span>
    </button>
  );
}
