import type { Config } from 'tailwindcss';

// SVTrip brand theme, shared by every interface (feature 007, T025).
//
// This is the mechanical half of Constitution Principle VI. Reviewing three
// codebases for brand fidelity by eye is how drift happens; there being exactly
// one palette to import is how it does not. The values resolve from the CSS
// custom properties in `@svtrip/core/styles/tokens.css`, which every consumer
// must also import — the preset names the tokens, the stylesheet defines them.
//
// Light-only. The brand has no dark theme and none may be introduced ad hoc
// (Principle V), which is why there is no `darkMode` key here to reach for.
export const svtripPreset = {
  content: [],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'primary-fg': 'rgb(var(--primary-fg) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        navy: 'rgb(var(--navy) / <alpha-value>)',
      },
      borderRadius: {
        md: '14px',
        lg: '20px',
        xl: '28px',
        pill: '999px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        red: 'var(--shadow-red)',
        gold: 'var(--shadow-gold)',
      },
      fontFamily: {
        sans: ['Nunito', 'system-ui', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default svtripPreset;
