// Reviews (feature 007, T078 — FR-028).
//
// THE ASYMMETRY IS THE POINT, and it is a security property, not a UI choice:
//
//   - Reads come straight from Firestore. `reviews` is the product's only
//     publicly readable collection, so anyone can see what was written.
//   - Writes go through the BFF. The Firestore rules deny client writes to
//     `reviews` outright (`allow create, update, delete: if false`).
//
// That denial is what makes FR-022 absolute: a business owner has no path —
// none — to alter or delete a review about their own business. There is no
// "simplify this into a direct write" available here. Removing the BFF hop would
// not make the code shorter; it would make the rules refuse every submission.
//
// A traveler may edit or delete only their OWN review, and the server decides
// that from the verified token, never from anything this component sends.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Review } from '@svtrip/shared';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import {
  findOwnReview,
  removeReview,
  submitReview,
  subscribeToReviews,
} from '@svtrip/core/repos/reviewsRepo';
import { Icon } from '@svtrip/core/Icon';
import { Button, Card, Spinner, TextArea, cx } from '../components/ui';

const MAX_COMMENT = 500;

function Stars({
  value,
  onChange,
  size = 16,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        const star = (
          <span className={filled ? 'text-accent' : 'text-border'}>
            <Icon name="star" size={size} filled={filled} />
          </span>
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={t('reviews.starLabel', { n })}
            className="transition hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

export function ReviewsSection({ targetId }: { targetId: string }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    setReviews(null);
    setFailed(false);
    return subscribeToReviews(
      targetId,
      (list) => setReviews(list),
      () => setFailed(true),
    );
  }, [targetId]);

  const mine = findOwnReview(reviews ?? [], user?.uid);

  useEffect(() => {
    // Seed the form from an existing review so "edit" edits rather than
    // silently starting from scratch.
    if (mine) {
      setRating(mine.rating);
      setComment(mine.comment ?? '');
    }
  }, [mine?.reviewId]);

  async function publish() {
    if (rating < 1) return;
    setBusy(true);
    try {
      await submitReview(targetId, rating, comment.trim() || undefined);
      setWriting(false);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await removeReview(targetId);
      setRating(0);
      setComment('');
      setWriting(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="font-display text-lg font-extrabold text-text">{t('reviews.title')}</h2>

      {failed && <p className="mt-3 text-sm text-muted">{t('reviews.loadFailed')}</p>}
      {!failed && reviews === null && <Spinner label={t('common.loading')} />}

      {!failed && reviews !== null && (
        <div className="mt-4 space-y-4">
          {!user && <p className="text-sm text-muted">{t('reviews.signInToWrite')}</p>}

          {user && !writing && (
            <Button variant="secondary" iconLeft="star" onClick={() => setWriting(true)}>
              {mine ? t('reviews.editMine') : t('reviews.writeCta')}
            </Button>
          )}

          {user && writing && (
            <Card className="space-y-3 p-5">
              <p className="font-display font-extrabold text-text">
                {mine ? t('reviews.editTitle') : t('reviews.writeTitle')}
              </p>
              <Stars value={rating} onChange={setRating} size={24} />
              <TextArea
                value={comment}
                maxLength={MAX_COMMENT}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('reviews.commentPlaceholder')}
              />
              <p className="text-xs text-muted">
                {t('reviews.charCount', { n: comment.length, max: MAX_COMMENT })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy || rating < 1} onClick={() => void publish()}>
                  {busy ? t('common.loading') : t('reviews.publish')}
                </Button>
                {mine && (
                  <Button variant="secondary" disabled={busy} onClick={() => void remove()}>
                    {t('reviews.removeMine')}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setWriting(false)}>
                  {t('common.close')}
                </Button>
              </div>
            </Card>
          )}

          {reviews.length === 0 ? (
            <p className="text-sm text-muted">{t('reviews.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((review) => (
                <li key={review.reviewId}>
                  <Card className={cx('p-5', review.authorUid === user?.uid && 'ring-1 ring-border')}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-sm font-extrabold text-muted">
                        {review.authorPhotoURL ? (
                          <img src={review.authorPhotoURL} alt="" className="h-full w-full object-cover" />
                        ) : (
                          review.authorName.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold text-text">{review.authorName}</p>
                        <p className="text-xs text-muted">
                          {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                            new Date(review.createdAt),
                          )}
                        </p>
                      </div>
                      <span className="ml-auto">
                        <Stars value={review.rating} />
                      </span>
                    </div>
                    {review.comment && (
                      <p className="mt-3 text-[15px] leading-relaxed text-text">{review.comment}</p>
                    )}
                    {review.reply && (
                      <div className="mt-3 rounded-md bg-surface-2 p-3">
                        <p className="text-xs font-extrabold text-muted">
                          {t('reviews.ownerReply', 'Respuesta del negocio')}
                        </p>
                        <p className="mt-1 text-sm text-text">{review.reply.text}</p>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
