// Global UI state: language, persona. Hydrated from localStorage for instant
// first paint, then reconciled with the user's Firestore preferences. There is
// no theme field — SVTrip has a single on-brand light theme (constitution v2.0.0).
import { create } from 'zustand';
import type { Language, Persona } from '@svtrip/shared';

const LS_KEY = 'svtrip:ui';

interface Persisted {
  language: Language;
  persona: Persona;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Persisted;
  } catch {
    /* ignore */
  }
  // Spanish-first by default (SVTrip is Spanish-primary).
  return { language: 'es', persona: 'traveler' };
}

interface UiState extends Persisted {
  /**
   * Set when someone registers as a business (feature 006, FR-001), consumed
   * once they land in the app so they arrive at claiming instead of the traveler
   * home. Deliberately NOT persisted: it is a one-shot routing hint, and a stale
   * copy in localStorage would keep hijacking the destination on every later
   * sign-in. Registration itself is identical for both choices — only what
   * happens after the account exists differs.
   */
  signupIntent: 'traveler' | 'business' | null;
  setLanguage: (l: Language) => void;
  setPersona: (p: Persona) => void;
  setSignupIntent: (i: 'traveler' | 'business' | null) => void;
  hydrateFrom: (p: Partial<Persisted>) => void;
}

function persist(state: Persisted): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const initial = load();

export const useUiStore = create<UiState>((set, get) => ({
  ...initial,
  signupIntent: null,
  setSignupIntent: (signupIntent) => set({ signupIntent }),
  setLanguage: (language) => {
    set({ language });
    persist({ ...pick(get()), language });
  },
  setPersona: (persona) => {
    set({ persona });
    persist({ ...pick(get()), persona });
  },
  hydrateFrom: (p) => {
    set(p);
    persist({ ...pick(get()), ...p });
  },
}));

function pick(s: Persisted): Persisted {
  return { language: s.language, persona: s.persona };
}
