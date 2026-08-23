// Shared vibe/mood -> brand icon mapping (used by onboarding and Discover's
// mood filter, since both operate on the same MOODS vocabulary).
import type { Mood } from '@svtrip/shared';
import type { IconName } from './Icon';

/**
 * The icon for a mood key, including one an admin invented (feature 010).
 *
 * `MOOD_ICON` is keyed by the built-in `Mood` union, which stopped being the
 * whole story the moment moods became admin-managed. Indexing it with a raw
 * string is now a type error AND a runtime `undefined` waiting to reach an
 * `<Icon name={undefined}>`, so every picker goes through this instead.
 * Choosing a per-mood icon stays a code change; adding a mood does not.
 */
export function moodIcon(key: string): IconName {
  return MOOD_ICON[key as Mood] ?? 'star';
}

export const MOOD_ICON: Record<Mood, IconName> = {
  'romantic-date': 'heart',
  'extreme-adventure': 'navigation',
  'local-food': 'utensils',
  nightlife: 'music',
  beach: 'waves',
  'colonial-town': 'home',
  hiking: 'mountain',
  culture: 'camera',
};
