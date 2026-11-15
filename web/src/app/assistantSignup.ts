// Feature 024 (T020): remember that a visitor arrived from an AI assistant's link, and tell the BFF
// once after they are signed in — so sign-ups that came from an assistant can be COUNTED (SC-012).
//
// sessionStorage, not localStorage: it survives the Google sign-in redirect inside this tab and is
// gone when the tab closes, so a traveler is never tagged for longer than one visit. Nothing is stored
// on the account; the server only bumps a daily counter, and only for an account created in the last
// hour. Every storage access is wrapped: a private window simply does not count.
const KEY = 'svtrip.assistantArrival';

export function captureAssistantArrival(search: string): void {
  try {
    if (new URLSearchParams(search).get('utm_source') === 'assistant') sessionStorage.setItem(KEY, '1');
  } catch {
    // no storage: not counted
  }
}

export async function reportAssistantArrival(post: (path: string, body: unknown) => Promise<unknown>): Promise<void> {
  let flagged = false;
  try {
    flagged = sessionStorage.getItem(KEY) === '1';
    if (flagged) sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  if (flagged) await post('/assistant/signup-attributed', {}).catch(() => undefined);
}
