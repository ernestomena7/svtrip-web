import { defineConfig } from 'vitest/config';

// The only reason this file exists: pin the timezone.
//
// `calendarDay.test.ts` asserts that a local calendar day is not a UTC one. In
// UTC those are the same instant, so the whole suite would pass on a UTC machine
// while proving nothing — and CI is usually UTC. Pinning to the timezone the
// product actually operates in makes the six-hour gap real in every run,
// including on a developer's laptop in another zone.
//
// America/El_Salvador is UTC-6 year-round with no daylight saving, which is also
// why it is a stable choice for a test fixture.
export default defineConfig({
  test: {
    env: { TZ: 'America/El_Salvador' },
  },
});
