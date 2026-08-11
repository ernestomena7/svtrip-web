// Shared vibe/mood -> brand icon mapping (used by onboarding and Discover's
// mood filter, since both operate on the same MOODS vocabulary).
import type { Mood } from '@svtrip/shared';
import type { IconName } from './Icon';

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
