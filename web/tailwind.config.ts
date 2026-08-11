import type { Config } from 'tailwindcss';
import { svtripPreset } from '@svtrip/core/tailwind.preset';

// The desktop app inherits the brand theme rather than restating it, so it
// cannot drift off-palette by construction (Principle VI). Token definitions
// come from `@svtrip/core/styles/tokens.css`, imported by the entry stylesheet.
const config: Config = {
  presets: [svtripPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
};

export default config;
