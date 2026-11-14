// Push on the phone (feature 020 US4). Native only — the desktop web app gets no push.
//
// THE RULES, each from the spec:
//   * Permission is NEVER asked at launch or sign-in. It is asked only when the person taps a prompt
//     that states why (FR-031, US4 scenario 1) — `enablePush`. `syncPushOnSignIn` never prompts.
//   * Refusal degrades, never breaks (FR-031): every state is still visible in the app. Nothing here
//     throws to a caller.
//   * The token is personal data (FR-033). One row per account per INSTALLATION in `devices`
//     (owner-only RLS), replaced when the token rotates, and DELETED on sign-out, so the next person
//     to sign in on this phone never receives the previous account's reservations.
import { Capacitor } from '@capacitor/core';
import { supabase } from '../supabase';

export type PushPermission = 'unavailable' | 'granted' | 'denied' | 'prompt';

const INSTALLATION_KEY = 'svtrip.push.installationId';

/** A stable id for this app installation — the row key, so a rotated token replaces its old row. */
function installationId(): string {
  try {
    let id = localStorage.getItem(INSTALLATION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(INSTALLATION_KEY, id);
    }
    return id;
  } catch {
    return 'default-installation';
  }
}

const native = () => Capacitor.isNativePlatform();
const plugin = async () => (await import('@capacitor/push-notifications')).PushNotifications;

/** The account the next registered token belongs to. */
let currentUid: string | null = null;
let listening = false;
let openHandler: ((route: string) => void) | null = null;
/** A tap that arrived before the app said where to navigate (cold start from a notification). */
let pendingRoute: string | null = null;

async function saveToken(uid: string, token: string): Promise<void> {
  const { error } = await supabase.from('devices').upsert(
    { profile_id: uid, id: installationId(), token, platform: Capacitor.getPlatform(), registered_at: new Date().toISOString() },
    { onConflict: 'profile_id,id' },
  );
  if (error) console.warn('[push] could not store the device token', error.message);
}

async function ensureListeners(): Promise<void> {
  if (listening || !native()) return;
  listening = true;
  const push = await plugin();
  await push.addListener('registration', ({ value }) => {
    if (currentUid) void saveToken(currentUid, value);
  });
  await push.addListener('registrationError', (err) => console.warn('[push] registration failed', err));
  await push.addListener('pushNotificationActionPerformed', (action) => {
    const route = (action.notification.data as { route?: unknown } | undefined)?.route;
    if (typeof route !== 'string' || !route.startsWith('/')) return; // only in-app paths
    if (openHandler) openHandler(route);
    else pendingRoute = route;
  });
}

/**
 * Where a tapped notification takes the person. Call once, from the app shell, with the router's
 * navigate. Registers the listeners at startup, so a notification that LAUNCHED the app is handled.
 */
export async function initPush(onOpen: (route: string) => void): Promise<void> {
  openHandler = onOpen;
  try {
    await ensureListeners();
  } catch (err) {
    console.warn('[push] could not start', err);
  }
  if (pendingRoute) {
    const route = pendingRoute;
    pendingRoute = null;
    onOpen(route);
  }
}

export async function pushPermission(): Promise<PushPermission> {
  if (!native()) return 'unavailable';
  try {
    const { receive } = await (await plugin()).checkPermissions();
    if (receive === 'granted') return 'granted';
    if (receive === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'unavailable';
  }
}

/** Asks the OS — only call from a prompt that has just stated the reason (FR-031). */
export async function enablePush(uid: string): Promise<PushPermission> {
  if (!native()) return 'unavailable';
  try {
    currentUid = uid;
    await ensureListeners();
    const push = await plugin();
    const { receive } = await push.requestPermissions();
    if (receive !== 'granted') return receive === 'denied' ? 'denied' : 'prompt';
    await push.register();
    return 'granted';
  } catch (err) {
    console.warn('[push] could not enable', err);
    return 'unavailable';
  }
}

/** On every sign-in: if notifications are ALREADY allowed, refresh this device's token. Never prompts. */
export async function syncPushOnSignIn(uid: string): Promise<void> {
  if (!native()) return;
  currentUid = uid;
  try {
    if ((await pushPermission()) !== 'granted') return;
    await ensureListeners();
    await (await plugin()).register();
  } catch (err) {
    console.warn('[push] could not refresh the token', err);
  }
}

/**
 * On sign-out, BEFORE the session ends (the delete needs it): this phone stops receiving this
 * account's pushes. Without it, the next person to sign in here would see the previous account's
 * reservation notices — on a shared phone, the whole point of the sign-out button.
 */
export async function forgetPushDevice(): Promise<void> {
  if (!native()) return;
  const uid = currentUid ?? (await supabase.auth.getSession()).data.session?.user.id ?? null;
  currentUid = null;
  try {
    if (uid) await supabase.from('devices').delete().eq('profile_id', uid).eq('id', installationId());
    await (await plugin()).unregister();
  } catch (err) {
    console.warn('[push] could not forget this device', err);
  }
}
