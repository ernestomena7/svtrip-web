// Feature 025 (T045, US4): the funnel's client side. Counts only — an origin and a step, no identifier.
//
// Each step is sent at most once per browser session (a flag in sessionStorage), and NEVER throws: a
// funnel that can break the form it measures is worse than no funnel. `step2_done` is not here — the
// server reads it from the registration records (M5).
import { postJson } from '@svtrip/core/apiClient';
import { API_BASE_URL } from '../config';
import type { SignupContext } from './signupContext';

const SENT_KEY = 'svtrip-signup-sent';

function alreadySent(step: string): boolean {
  try {
    const sent = JSON.parse(sessionStorage.getItem(SENT_KEY) ?? '[]') as string[];
    if (sent.includes(step)) return true;
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent, step]));
    return false;
  } catch {
    return false; // private mode: better a duplicate count than none
  }
}

/** The first interaction with Step 1 — a field focus or the Google button, whichever comes first (U5). */
export function trackStep1Started(ctx: SignupContext): void {
  if (alreadySent('step1_started')) return;
  try {
    void fetch(`${API_BASE_URL}/public/signup-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step: 'step1_started', origin: ctx.origin }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // no fetch in this environment: the funnel stays silent rather than breaking the form
  }
}

/** Step 1 finished (signed in). */
export function trackStep1Done(ctx: SignupContext): void {
  if (alreadySent('step1_done')) return;
  void postJson('/business-signup/step1-done', { origin: ctx.origin }).catch(() => undefined);
}
