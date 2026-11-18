import { describe, it, expect, vi } from 'vitest';
import { urlBase64ToUint8Array, pushSupported, permissionState, subscribe, unsubscribe, sendTestNotification, inspectPush, HOW_TO_REENABLE } from '../pushClient.js';

const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function makeEnv({ permission = 'default', request = 'granted', ua = 'Chrome', supported = true } = {}) {
  const Notification = { permission, requestPermission: vi.fn(async () => { Notification.permission = request; return request; }) };
  const env = { navigator: { userAgent: ua, serviceWorker: {} }, Notification };
  if (supported) env.PushManager = function PushManager() {};
  else delete env.navigator.serviceWorker;
  return env;
}
function makeSub(endpoint = 'https://push.example/abc') {
  return { endpoint, toJSON: () => ({ endpoint, keys: { p256dh: 'P', auth: 'A' } }), unsubscribe: vi.fn(async () => true) };
}
function makeRegistration(sub = makeSub()) {
  let current = null;
  return {
    sub,
    pushManager: { subscribe: vi.fn(async () => { current = sub; return sub; }), getSubscription: vi.fn(async () => current) },
    showNotification: vi.fn(async () => {}),
    _set: (s) => { current = s; },
  };
}
function makeClient({ delError = null, insError = null } = {}) {
  const calls = [];
  return {
    calls,
    from: (table) => ({
      delete: () => ({ eq: async (col, val) => { calls.push(['delete', table, col, val]); return { error: delError }; } }),
      insert: async (row) => { calls.push(['insert', table, row]); return { error: insError }; },
    }),
  };
}

describe('urlBase64ToUint8Array', () => {
  it('decodes base64url without padding', () => {
    const out = urlBase64ToUint8Array(KEY);
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(65);
    expect(out[0]).toBe(4);
  });
});

describe('support and permission', () => {
  it('reports unsupported browsers', () => {
    expect(pushSupported(makeEnv({ supported: false }))).toBe(false);
    expect(permissionState(makeEnv({ supported: false }))).toBe('unsupported');
    expect(permissionState(makeEnv({ permission: 'granted' }))).toBe('granted');
  });
});

describe('subscribe', () => {
  it('unsupported browser: explains Add to Home Screen on iOS and never asks for permission', async () => {
    const env = makeEnv({ supported: false, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' });
    const r = await subscribe({ vapidKey: KEY, registration: makeRegistration(), client: makeClient(), env });
    expect(r.status).toBe('unsupported');
    expect(r.message).toMatch(/Home Screen/);
    expect(env.Notification.requestPermission).not.toHaveBeenCalled();
  });
  it('missing VAPID key and missing service worker are reported without prompting', async () => {
    const env = makeEnv();
    expect((await subscribe({ vapidKey: '', registration: makeRegistration(), client: makeClient(), env })).status).toBe('no-vapid');
    const r = await subscribe({ vapidKey: KEY, registration: null, client: makeClient(), env });
    expect(r.status).toBe('no-service-worker');
    expect(r.message).toMatch(/deployed site/);
    expect(env.Notification.requestPermission).not.toHaveBeenCalled();
  });
  it('already blocked: tells how to re-enable and does not prompt', async () => {
    const env = makeEnv({ permission: 'denied' });
    const r = await subscribe({ vapidKey: KEY, registration: makeRegistration(), client: makeClient(), env });
    expect(r).toEqual({ status: 'blocked', message: HOW_TO_REENABLE });
    expect(env.Notification.requestPermission).not.toHaveBeenCalled();
  });
  it('permission denied in the prompt: nothing is subscribed or stored', async () => {
    const env = makeEnv({ request: 'denied' }); const reg = makeRegistration(); const client = makeClient();
    const r = await subscribe({ vapidKey: KEY, registration: reg, client, env });
    expect(r.status).toBe('denied');
    expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
    expect(client.calls).toEqual([]);
  });
  it('dismissed prompt is not an error', async () => {
    const r = await subscribe({ vapidKey: KEY, registration: makeRegistration(), client: makeClient(), env: makeEnv({ request: 'default' }) });
    expect(r.status).toBe('dismissed');
  });
  it('success: subscribes visibly with the converted key and stores the row', async () => {
    const env = makeEnv(); const reg = makeRegistration(); const client = makeClient();
    const r = await subscribe({ vapidKey: KEY, registration: reg, client, env });
    expect(r.status).toBe('subscribed');
    const opts = reg.pushManager.subscribe.mock.calls[0][0];
    expect(opts.userVisibleOnly).toBe(true);
    expect(opts.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(client.calls).toEqual([
      ['delete', 'owner_push_subscriptions', 'endpoint', 'https://push.example/abc'],
      ['insert', 'owner_push_subscriptions', { endpoint: 'https://push.example/abc', p256dh: 'P', auth: 'A', user_agent: 'Chrome' }],
    ]);
  });
  it('retries once when an old subscription used a different server key', async () => {
    const env = makeEnv(); const reg = makeRegistration(); const old = makeSub('https://old');
    reg.pushManager.getSubscription = vi.fn(async () => old);
    reg.pushManager.subscribe = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'InvalidStateError' }))
      .mockResolvedValueOnce(reg.sub);
    const r = await subscribe({ vapidKey: KEY, registration: reg, client: makeClient(), env });
    expect(r.status).toBe('subscribed');
    expect(old.unsubscribe).toHaveBeenCalled();
  });
  it('a failing database write is reported as an error, not thrown, and leaks no endpoint', async () => {
    const r = await subscribe({ vapidKey: KEY, registration: makeRegistration(), client: makeClient({ insError: { message: 'denied by policy' } }), env: makeEnv() });
    expect(r.status).toBe('error');
    expect(r.message).toContain('denied by policy');
    expect(r.message).not.toContain('push.example');
  });
});

describe('unsubscribe, test notification, inspect', () => {
  it('deletes the row by endpoint then unsubscribes the browser', async () => {
    const reg = makeRegistration(); reg._set(reg.sub); const client = makeClient();
    const r = await unsubscribe({ registration: reg, client });
    expect(r.status).toBe('unsubscribed');
    expect(client.calls).toEqual([['delete', 'owner_push_subscriptions', 'endpoint', 'https://push.example/abc']]);
    expect(reg.sub.unsubscribe).toHaveBeenCalled();
  });
  it('keeps the browser subscription if the row delete fails', async () => {
    const reg = makeRegistration(); reg._set(reg.sub);
    const r = await unsubscribe({ registration: reg, client: makeClient({ delError: { message: 'nope' } }) });
    expect(r.status).toBe('error');
    expect(reg.sub.unsubscribe).not.toHaveBeenCalled();
  });
  it('send test uses a local notification and needs permission', async () => {
    const reg = makeRegistration();
    expect((await sendTestNotification({ registration: reg, env: makeEnv({ permission: 'default' }) })).status).toBe('blocked');
    expect((await sendTestNotification({ registration: reg, env: makeEnv({ permission: 'granted' }) })).status).toBe('sent');
    expect(reg.showNotification).toHaveBeenCalledTimes(1);
  });
  it('missing VAPID key hides the whole UI (state hidden)', async () => {
    expect((await inspectPush({ vapidKey: '', env: makeEnv() })).state).toBe('hidden');
  });
  it('inspect: no service worker (dev), blocked, off, on', async () => {
    const env = makeEnv(); env.navigator.serviceWorker = { getRegistration: vi.fn(async () => undefined) };
    expect((await inspectPush({ vapidKey: KEY, env })).state).toBe('no-service-worker');
    const reg = makeRegistration();
    env.navigator.serviceWorker.getRegistration = vi.fn(async () => reg);
    expect((await inspectPush({ vapidKey: KEY, env })).state).toBe('off');
    env.Notification.permission = 'granted'; reg._set(reg.sub);
    expect((await inspectPush({ vapidKey: KEY, env })).state).toBe('on');
    env.Notification.permission = 'denied';
    expect((await inspectPush({ vapidKey: KEY, env })).state).toBe('blocked');
  });
});
