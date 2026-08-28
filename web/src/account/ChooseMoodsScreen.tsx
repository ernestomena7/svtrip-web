// The first-run mood step on the desktop web app.
//
// This surface has never had one. Feature 009 found the same gap for editing
// moods and closed it on the profile screen; what was still missing is the step
// that ASKS in the first place, so a web-only account reached Discover with
// `preferences.vibes` empty and "Para vos" — on this same surface — reading a
// preference nobody had ever offered to set.
//
// It renders AFTER `CompleteProfileScreen` and before anything else, matching
// the mobile order: "who are you" precedes "what do you like".
//
// Deliberately calls `completeOnboarding`, which is the ONE writer that also
// flips `onboardingComplete`. The profile-screen editor calls
// `updatePreferences` instead precisely so an ongoing edit never touches that
// flag (feature 009, FR-007) — this screen is the other half of that split, and
// it is the only place on this surface allowed to set it.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MOODS } from '@svtrip/shared';
import { TaxonomyGlyph } from '@svtrip/core/TaxonomyGlyph';
import { useAuth } from '@svtrip/core/auth/AuthProvider';
import { completeOnboarding } from '@svtrip/core/auth/userProfile';
import { useMergedTaxonomy } from '@svtrip/core/taxonomy/useTaxonomy';
import { Button, Card, ErrorState, cx } from '../components/ui';

export function ChooseMoodsScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // Admin-managed moods (feature 010): an entry added in the taxonomy manager
  // appears here without a release, and a deactivated one disappears.
  const {
    keys: moodKeys,
    label: moodLabel,
    icon: moodGlyph,
  } = useMergedTaxonomy('moods', MOODS, selected);

  function toggle(mood: string) {
    setSelected((prev) => (prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]));
  }

  async function submit() {
    // At least one, same floor the mobile step and the profile editor hold. An
    // account that got through with none would land on a "Para vos" row with
    // nothing to say and no obvious way to fix it.
    if (!user || selected.length === 0) return;
    setSaving(true);
    setFailed(false);
    try {
      await completeOnboarding(user.uid, selected);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-bg px-5 py-10">
      <Card className="w-full max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-text">
            {t('onboarding.title')}
          </h1>
          <p className="mt-2 text-sm text-muted">{t('onboarding.subtitle')}</p>
        </div>

        {failed && <ErrorState message={t('common.somethingWrong')} />}

        {/* The same pill vocabulary as the mobile step and as this surface's own
            profile editor — one choice, one visual language, wherever it is
            made. */}
        <div className="flex flex-wrap gap-2">
          {moodKeys.map((mood) => {
            const active = selected.includes(mood);
            return (
              <button
                key={mood}
                type="button"
                onClick={() => toggle(mood)}
                aria-pressed={active}
                className={cx(
                  'inline-flex items-center gap-2 rounded-pill border px-3.5 py-2 text-sm font-bold transition',
                  active
                    ? 'border-transparent bg-sunset text-white shadow-red'
                    : 'border-border bg-surface text-text hover:bg-surface-2',
                )}
              >
                <TaxonomyGlyph resolved={moodGlyph(mood)} size={15} />
                {moodLabel(mood)}
              </button>
            );
          })}
        </div>

        <div>
          <Button onClick={() => void submit()} disabled={saving || selected.length === 0}>
            {t('onboarding.continue')}
          </Button>
          {selected.length === 0 && (
            <p className="mt-2 text-xs text-muted">{t('onboarding.selectAtLeastOne')}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
