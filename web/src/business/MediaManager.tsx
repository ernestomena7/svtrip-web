// Photos, banner, gallery and menu (feature 007, T100 — FR-032).
//
// One component for four collections because they differ only in shape and
// limits. Uploads go through `photoUpload` in `@svtrip/core`, which is the same
// path the mobile app uses — including its distinction between an unusable FILE
// and an unavailable SERVICE. Telling an owner "storage is unavailable" when
// they picked a PDF sends them chasing the wrong problem.
//
// A Storage failure never blocks saving: the business's text is worth keeping
// even when its photo did not upload.
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_IMAGE_BYTES, PhotoRejected, uploadListingPhoto } from '@svtrip/core/repos/photoUpload';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { Icon } from '@svtrip/core/Icon';
import { cx } from '../components/ui';

interface Props {
  label: string;
  hint?: string;
  urls: string[];
  onChange: (next: string[]) => void;
  /** Single-slot collections (the banner) replace instead of appending. */
  single?: boolean;
  /** Refuse to remove the last item — see FR-023. */
  lockLast?: boolean;
  aspect?: 'wide' | 'square' | 'tall';
}

const BOX = {
  wide: 'h-28 w-full',
  square: 'h-24 w-24',
  tall: 'h-28 w-20',
};

export function MediaManager({ label, hint, urls, onChange, single, lockLast, aspect = 'square' }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceDown, setServiceDown] = useState(false);

  async function pick(file: File | undefined) {
    if (!file || !user) return;
    setBusy(true);
    setError(null);
    setServiceDown(false);
    try {
      const url = await uploadListingPhoto(user.uid, file);
      onChange(single ? [url] : [...urls, url]);
    } catch (err) {
      if (err instanceof PhotoRejected) {
        setError(
          err.reason === 'type'
            ? t('services.photoTypeRejected')
            : t('services.photoSizeRejected', { mb: Math.round(MAX_IMAGE_BYTES / 1024 / 1024) }),
        );
      } else {
        // Not an error the owner caused, and not a reason to lose their work.
        setServiceDown(true);
      }
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  function remove(url: string) {
    if (lockLast && urls.length === 1) {
      setError(t('publication.lastPhotoLocked'));
      return;
    }
    setError(null);
    onChange(urls.filter((u) => u !== url));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= urls.length) return;
    const next = [...urls];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-muted">{label}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}

      <div className="flex flex-wrap gap-3">
        {urls.map((url, i) => (
          <div key={url} className={cx('group relative overflow-hidden rounded-md', BOX[aspect])}>
            <img src={url} alt="" className="h-full w-full object-cover" />

            <button
              type="button"
              onClick={() => remove(url)}
              aria-label={t('services.delete')}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/85 text-navy transition hover:bg-white"
            >
              <Icon name="x" size={12} />
            </button>

            {/* The stored order IS the order travelers see, so it has to be
                changeable. Arrows rather than drag: reliable, and reachable by
                keyboard. */}
            {!single && urls.length > 1 && (
              <span className="absolute inset-x-0 bottom-0 flex bg-black/45 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={t('services.reorderLeft')}
                  className="flex h-7 flex-1 items-center justify-center text-white disabled:opacity-30"
                >
                  <Icon name="chevron-left" size={14} />
                </button>
                <button
                  type="button"
                  disabled={i === urls.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={t('services.reorderRight')}
                  className="flex h-7 flex-1 items-center justify-center text-white disabled:opacity-30"
                >
                  <Icon name="chevron-right" size={14} />
                </button>
              </span>
            )}
          </div>
        ))}

        {(!single || urls.length === 0) && (
          <label
            className={cx(
              'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted transition hover:border-primary hover:text-primary',
              BOX[aspect],
            )}
          >
            <Icon name={busy ? 'clock' : 'camera'} size={20} />
            <span className="text-[11px] font-bold">
              {busy ? t('services.uploading') : t('services.addPhoto')}
            </span>
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={busy}
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {error && <p className="text-xs font-bold text-primary">{error}</p>}
      {serviceDown && <p className="text-xs text-muted">{t('services.photoUploadUnavailable')}</p>}
    </div>
  );
}
