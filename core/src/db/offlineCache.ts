// Offline reading (feature 023, FR-019 / T055b) — what Firestore's `persistentLocalCache` gave for
// free: a screen the traveler already loaded stays readable with no signal (feature 001, T096).
//
// Deliberately small: the last successful result of each read, by key, in localStorage — enough at
// this product's size (33 listings, a few conversations per traveler), and it persists in the
// Capacitor webview across app restarts. Every access is wrapped — private browsing, a full quota or a blocked
// store must degrade to "no cache", never to a crash or a blank screen. The cache only ever SERVES
// data the server returned before; it never invents a value, so a first visit with no network still
// shows the screen's existing error state.
const PREFIX = 'svtrip-cache:v1:';

function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function remember(key: string, value: unknown): void {
  try {
    store()?.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Quota or a blocked store: offline reading is a convenience, not a guarantee.
  }
}

export function recall<T>(key: string): T | undefined {
  try {
    const raw = store()?.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw).value as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Sign-out must not leave one account's private data readable by the next person on the phone. */
export function forgetAll(): void {
  try {
    const s = store();
    if (!s) return;
    for (let i = s.length - 1; i >= 0; i--) {
      const k = s.key(i);
      if (k?.startsWith(PREFIX)) s.removeItem(k);
    }
  } catch {
    // Nothing to clear.
  }
}

/**
 * A network read with the offline fallback: on success the result is remembered; on failure the
 * last remembered result is served if there is one, otherwise the error propagates unchanged — so
 * the screen's own error state still appears on a first offline visit.
 */
export async function readThrough<T>(key: string, read: () => Promise<T>): Promise<T> {
  try {
    const value = await read();
    remember(key, value);
    return value;
  } catch (err) {
    const cached = recall<T>(key);
    if (cached !== undefined) return cached;
    throw err;
  }
}
