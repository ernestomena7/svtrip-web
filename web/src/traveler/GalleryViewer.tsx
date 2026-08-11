// Full-size photo viewer (feature 007, T079).
//
// A real modal dialog rather than a bigger thumbnail: `role="dialog"` with
// `aria-modal`, Escape to close, and arrow keys to move. On a desktop the
// keyboard is how people page through photos, and a viewer that only responds
// to clicks is a viewer half the audience cannot drive.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@svtrip/core/Icon';

export function GalleryViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: string[];
  index: number | null;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const open = index !== null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndexChange(Math.min(images.length - 1, (index ?? 0) + 1));
      if (e.key === 'ArrowLeft') onIndexChange(Math.max(0, (index ?? 0) - 1));
    }
    window.addEventListener('keydown', onKey);
    // The page behind must not scroll while a full-screen overlay is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.gallery.viewerLabel')}
      className="fixed inset-0 z-50 flex flex-col bg-navy/95 backdrop-blur"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-sm font-bold text-white/80">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="text-white transition hover:opacity-70"
        >
          <Icon name="x" size={24} />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-6">
        <img
          src={images[index]}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-5xl object-contain"
        />
      </div>

      {images.length > 1 && (
        <div
          className="flex items-center justify-center gap-6 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onIndexChange(Math.max(0, index - 1))}
            disabled={index === 0}
            aria-label={t('profile.gallery.previous')}
            className="text-white transition disabled:opacity-30"
          >
            <Icon name="chevron-left" size={28} />
          </button>
          <button
            type="button"
            onClick={() => onIndexChange(Math.min(images.length - 1, index + 1))}
            disabled={index === images.length - 1}
            aria-label={t('profile.gallery.next')}
            className="text-white transition disabled:opacity-30"
          >
            <Icon name="chevron-right" size={28} />
          </button>
        </div>
      )}
    </div>
  );
}
