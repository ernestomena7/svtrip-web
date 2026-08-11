// Past conversations (feature 007, T091 — FR-014).
//
// The requirement is not "a list exists" — it is that the web app shows the SAME
// account's conversations the phone wrote. One account, not two. So this reads
// `users/{uid}/conversations`, which is exactly where the mobile guide persists
// its turns, rather than any web-only store.
//
// Nothing in the product listed conversations before this: the mobile guide
// starts a fresh one on every mount and subscribes only to that one. A phone has
// no room for a history rail; a 1440px screen does, and the conversations were
// being written all along with nobody able to reach them.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Conversation } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { subscribeToConversations } from '@svtrip/core/repos/conversationRepo';
import { Icon } from '@svtrip/core/Icon';
import { Card, Spinner, cx } from '../components/ui';

export function ConversationHistory({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (conversationId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFailed(false);
    return subscribeToConversations(user.uid, setConversations, () => setFailed(true));
  }, [user]);

  // Absent rather than an error box: the history is a convenience beside a
  // working conversation, and a failure to list it must not imply the guide
  // itself is broken.
  if (failed) return null;
  if (!user) return null;

  if (conversations === null) {
    return (
      <Card className="p-5">
        <Spinner />
      </Card>
    );
  }

  if (conversations.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted">{t('web.history.empty')}</p>
      </Card>
    );
  }

  const when = (ms: number) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(ms));

  return (
    <Card className="overflow-hidden">
      <p className="border-b border-border px-5 py-3 font-display text-sm font-extrabold text-text">
        {t('web.history.title')}
      </p>
      <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
        {conversations.map((conversation) => (
          <li key={conversation.conversationId}>
            <button
              type="button"
              onClick={() => onSelect(conversation.conversationId)}
              aria-current={activeId === conversation.conversationId ? 'true' : undefined}
              className={cx(
                'flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-surface-2',
                activeId === conversation.conversationId && 'bg-surface-2',
              )}
            >
              <span className="mt-0.5 shrink-0 text-muted">
                <Icon name="sparkles" size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-text">
                  {conversation.title?.trim() || t('web.history.untitled')}
                </span>
                {conversation.lastMessagePreview && (
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {conversation.lastMessagePreview}
                  </span>
                )}
                {conversation.updatedAt > 0 && (
                  <span className="mt-1 block text-[11px] text-muted">
                    {when(conversation.updatedAt)}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
