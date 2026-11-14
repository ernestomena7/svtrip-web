// @vitest-environment jsdom
//
// Push on the phone (feature 020 US4). NEW FILE. The rules each case pins:
//   * FR-031: nothing asks for permission except an explicit tap (`enablePush`); sign-in only
//     refreshes a token that is ALREADY allowed.
//   * Refusal and the desktop web degrade to "no push", never to an error.
//   * FR-033: one row per account per installation, replaced when the token rotates, and DELETED on
//     sign-out — the next person on this phone must not receive the previous account's notices.
//   * A tap opens only an in-app path, never an arbitrary URL from the payload.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from './fakeSupabase';

let native = true;
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native, getPlatform: () => 'android' } }));

type Handler = (payload: unknown) => void;
let listeners: Record<string, Handler> = {};
let receive: 'granted' | 'denied' | 'prompt' = 'prompt';
const PushNotifications = {
  addListener: vi.fn(async (event: string, h: Handler) => {
    listeners[event] = h;
    return { remove: async () => undefined };
  }),
  checkPermissions: vi.fn(async () => ({ receive })),
  requestPermissions: vi.fn(async () => ({ receive })),
  register: vi.fn(async () => undefined),
  unregister: vi.fn(async () => undefined),
};
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications }));

const fake = createFakeSupabase();
vi.mock('../src/supabase', () => ({ supabase: fake.client, auth: { currentUser: null } }));

const UID = 'aaaaaaaa-0000-4000-8000-000000000001';

async function load() {
  vi.resetModules(); // the module keeps listener state; each case starts from a fresh app launch
  return import('../src/push/pushRegistration');
}

beforeEach(() => {
  fake.reset();
  listeners = {};
  receive = 'prompt';
  native = true;
  localStorage.clear();
  for (const fn of Object.values(PushNotifications)) fn.mockClear();
});

describe('asking (FR-031)', () => {
  it('signing in NEVER asks — it only refreshes a token that is already allowed', async () => {
    const push = await load();
    await push.syncPushOnSignIn(UID);
    expect(PushNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(PushNotifications.register).not.toHaveBeenCalled(); // not allowed yet: nothing to refresh
  });

  it('with permission already granted, sign-in registers and stores the token', async () => {
    receive = 'granted';
    const push = await load();
    await push.syncPushOnSignIn(UID);
    expect(PushNotifications.register).toHaveBeenCalledTimes(1);
    listeners.registration({ value: 'token-1' });
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.tables.devices).toHaveLength(1);
    expect(fake.tables.devices[0]).toMatchObject({ profile_id: UID, token: 'token-1', platform: 'android' });
  });

  it('a refusal returns "denied", registers nothing and stores nothing', async () => {
    receive = 'denied';
    const push = await load();
    expect(await push.enablePush(UID)).toBe('denied');
    expect(PushNotifications.register).not.toHaveBeenCalled();
    expect(fake.tables.devices ?? []).toHaveLength(0);
  });

  it('on the desktop web there is no push — and no error', async () => {
    native = false;
    const push = await load();
    expect(await push.pushPermission()).toBe('unavailable');
    expect(await push.enablePush(UID)).toBe('unavailable');
    expect(PushNotifications.requestPermissions).not.toHaveBeenCalled();
  });
});

describe('the device row (FR-033)', () => {
  it('a rotated token REPLACES this installation’s row instead of adding one', async () => {
    receive = 'granted';
    const push = await load();
    await push.enablePush(UID);
    listeners.registration({ value: 'token-1' });
    await new Promise((r) => setTimeout(r, 0));
    listeners.registration({ value: 'token-2' });
    await new Promise((r) => setTimeout(r, 0));
    expect(fake.tables.devices).toHaveLength(1);
    expect(fake.tables.devices[0].token).toBe('token-2');
  });

  it('sign-out deletes this phone’s row for the account, and unregisters', async () => {
    receive = 'granted';
    const push = await load();
    await push.enablePush(UID);
    listeners.registration({ value: 'token-1' });
    await new Promise((r) => setTimeout(r, 0));
    await push.forgetPushDevice();
    expect(fake.tables.devices).toHaveLength(0);
    expect(PushNotifications.unregister).toHaveBeenCalled();
  });

  it('sign-out still completes when the plugin fails', async () => {
    const push = await load();
    PushNotifications.unregister.mockRejectedValueOnce(new Error('plugin gone'));
    await expect(push.forgetPushDevice()).resolves.toBeUndefined();
  });
});

describe('tapping a notification', () => {
  it('opens the in-app screen it names', async () => {
    const push = await load();
    const open = vi.fn();
    await push.initPush(open);
    listeners.pushNotificationActionPerformed({ notification: { data: { route: '/reservations' } } });
    expect(open).toHaveBeenCalledWith('/reservations');
  });

  it('ignores anything that is not an in-app path', async () => {
    const push = await load();
    const open = vi.fn();
    await push.initPush(open);
    listeners.pushNotificationActionPerformed({ notification: { data: { route: 'https://evil.example' } } });
    listeners.pushNotificationActionPerformed({ notification: { data: {} } });
    expect(open).not.toHaveBeenCalled();
  });
});
