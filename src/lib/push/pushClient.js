/**
 * Browser side of Web Push: feature detection, permission state, subscribe / unsubscribe for THIS device and the
 * `owner_push_subscriptions` row the server sends to. Every browser dependency is injected (`env`, `registration`,
 * `client`) so it is unit-testable. Subscription endpoints and keys are never logged.
 */

export const PUSH_TABLE = 'owner_push_subscriptions';

export function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function vapidKeyFromEnv() {
  try { return String(import.meta.env?.VITE_VAPID_PUBLIC_KEY || '').trim(); } catch { return ''; }
}

export function pushSupported(env = globalThis) {
  return !!(env?.navigator && 'serviceWorker' in env.navigator && 'PushManager' in env && 'Notification' in env);
}

/** 'unsupported' | 'default' | 'granted' | 'denied' */
export function permissionState(env = globalThis) {
  if (!pushSupported(env)) return 'unsupported';
  return env.Notification.permission || 'default';
}

/** The registration of the production service worker, or null (dev builds never register it). */
export async function getPushRegistration(env = globalThis) {
  try {
    if (!env?.navigator?.serviceWorker) return null;
    return (await env.navigator.serviceWorker.getRegistration('/sw.js')) || (await env.navigator.serviceWorker.getRegistration()) || null;
  } catch { return null; }
}

export async function currentSubscription({ registration } = {}) {
  try { return (await registration?.pushManager?.getSubscription?.()) || null; } catch { return null; }
}

function rowFor(subscription, env) {
  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
  const p256dh = json?.keys?.p256dh; const auth = json?.keys?.auth;
  if (!json?.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, p256dh, auth, user_agent: String(env?.navigator?.userAgent || '').slice(0, 300) };
}

/**
 * Saves this device's subscription. Preferred: the database function register_push_subscription, which creates or refreshes the
 * row in ONE statement (an endpoint that belongs to another account still fails with 23505, as a plain insert would).
 * Only while that migration is not applied (function missing) does it fall back to the older delete + insert, below.
 */
export async function storeSubscription({ client, subscription, env = globalThis }) {
  const row = rowFor(subscription, env);
  if (!row) throw new Error('The browser returned an incomplete push subscription.');
  if (typeof client?.rpc === 'function') {
    // A call that throws (network failure, timeout) is NOT a reason to switch to the non-atomic path: it surfaces as an error the owner can retry.
    const res = await client.rpc('register_push_subscription', { p_endpoint: row.endpoint, p_p256dh: row.p256dh, p_auth: row.auth, p_user_agent: row.user_agent });
    if (!res?.error) return;
    if (!isMissingFunction(res.error)) {
      const err = new Error(res.error.message || 'Could not save this device registration');
      err.code = res.error.code;
      throw err;
    }
    // only a function that is not there yet (migration not applied) falls back to the older path
  }
  return storeSubscriptionLegacy({ client, row });
}

const isMissingFunction = (e) => e?.code === 'PGRST202' || e?.code === '42883';

/**
 * The pre-function path. There is no UPDATE policy, so an existing row is deleted first; if the new row cannot be
 * saved, the previous one is put back so a working registration is never lost to a failed refresh.
 */
async function storeSubscriptionLegacy({ client, row }) {
  let previous = null;
  try {
    const found = await client.from(PUSH_TABLE).select?.('endpoint, p256dh, auth, user_agent')?.eq?.('endpoint', row.endpoint)?.limit?.(1);
    previous = Array.isArray(found?.data) && found.data[0] ? found.data[0] : null;
  } catch { /* best effort: without it a failed save simply cannot be rolled back */ }
  const del = await client.from(PUSH_TABLE).delete().eq('endpoint', row.endpoint);
  if (del?.error) throw new Error(del.error.message || 'Could not refresh this device registration');
  const ins = await client.from(PUSH_TABLE).insert(row);
  if (ins?.error) {
    if (previous) { try { await client.from(PUSH_TABLE).insert(previous); } catch { /* nothing more to do */ } }
    const err = new Error(ins.error.message || 'Could not save this device registration');
    err.code = ins.error.code;
    throw err;
  }
}

export const HOW_TO_REENABLE = 'Notifications are blocked for this site. Open your browser\'s site settings (the lock or tune icon next to the address), set Notifications to Allow, then reload this page and try again.';

function unsupportedMessage(env) {
  const ua = String(env?.navigator?.userAgent || '');
  if (/iPhone|iPad|iPod/i.test(ua)) return 'On iPhone and iPad, push notifications need this site added to your Home Screen first (Share, then Add to Home Screen), then opened from there.';
  return 'This browser does not support push notifications.';
}

/**
 * Must be called from a user gesture (click). Resolves to { status, message } where status is one of
 * subscribed | unsupported | no-vapid | no-service-worker | blocked | denied | dismissed | error.
 */
export async function subscribe({ vapidKey, registration, client, env = globalThis } = {}) {
  if (!pushSupported(env)) return { status: 'unsupported', message: unsupportedMessage(env) };
  if (!vapidKey) return { status: 'no-vapid', message: 'Push notifications aren\'t set up on this site yet.' };
  if (!registration?.pushManager) return { status: 'no-service-worker', message: 'Push works on the deployed site. The background service is not running in this environment.' };
  if (env.Notification.permission === 'denied') return { status: 'blocked', message: HOW_TO_REENABLE };
  try {
    if (env.Notification.permission !== 'granted') {
      const result = await env.Notification.requestPermission();
      if (result === 'denied') return { status: 'denied', message: HOW_TO_REENABLE };
      if (result !== 'granted') return { status: 'dismissed', message: 'Permission was not granted. You can try again any time.' };
    }
    const options = { userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) };
    let subscription;
    try {
      subscription = await registration.pushManager.subscribe(options);
    } catch (err) {
      // A subscription made with a different server key blocks a new one: drop it and retry once.
      if (err?.name !== 'InvalidStateError') throw err;
      const old = await registration.pushManager.getSubscription();
      await old?.unsubscribe?.();
      subscription = await registration.pushManager.subscribe(options);
    }
    try {
      await storeSubscription({ client, subscription, env });
    } catch (err) {
      // This browser's subscription is already registered to another account (unique endpoint): start a fresh one for this account.
      if (err?.code !== '23505' || typeof subscription?.unsubscribe !== 'function') throw err;
      await subscription.unsubscribe();
      subscription = await registration.pushManager.subscribe(options);
      await storeSubscription({ client, subscription, env });
    }
    return { status: 'subscribed', message: 'Push notifications are on for this device.' };
  } catch (err) {
    return { status: 'error', message: err?.message ? `Could not turn on push notifications: ${err.message}` : 'Could not turn on push notifications.' };
  }
}

/** Removes this device: the server row first (needs the endpoint), then the browser subscription. */
export async function unsubscribe({ registration, client } = {}) {
  try {
    const subscription = await currentSubscription({ registration });
    if (!subscription) return { status: 'unsubscribed', message: 'Push notifications are off for this device.' };
    const { endpoint } = subscription;
    const del = await client.from(PUSH_TABLE).delete().eq('endpoint', endpoint);
    if (del?.error) return { status: 'error', message: del.error.message || 'Could not remove this device registration.' };
    await subscription.unsubscribe();
    return { status: 'unsubscribed', message: 'Push notifications are off for this device.' };
  } catch (err) {
    return { status: 'error', message: err?.message || 'Could not turn off push notifications.' };
  }
}

/** Local notification (no server involved) so the owner can check that permission and the OS display work. */
export async function sendTestNotification({ registration, env = globalThis } = {}) {
  if (permissionState(env) !== 'granted') return { status: 'blocked', message: 'Allow notifications first.' };
  if (!registration?.showNotification) return { status: 'no-service-worker', message: 'Push works on the deployed site.' };
  try {
    await registration.showNotification('Test notification', { body: 'Alerts will look like this on this device.', tag: 'smartvideo-test', icon: '/favicon.webp', badge: '/favicon.webp', data: { url: '/#/timeline', type: 'test' } });
    return { status: 'sent', message: 'Test notification sent. If you did not see it, check your system notification settings.' };
  } catch (err) {
    return { status: 'error', message: err?.message || 'Could not show the test notification.' };
  }
}

/**
 * One call for the UI: what to show. state is one of
 * hidden (no VAPID key) | unsupported | no-service-worker | blocked | off | on.
 */
export async function inspectPush({ vapidKey, env = globalThis, client } = {}) {
  if (!vapidKey) return { state: 'hidden', message: 'Push notifications aren\'t set up on this site yet.' };
  if (!pushSupported(env)) return { state: 'unsupported', message: unsupportedMessage(env) };
  const registration = await getPushRegistration(env);
  if (!registration) return { state: 'no-service-worker', registration: null, message: 'Push works on the deployed site.' };
  if (permissionState(env) === 'denied') return { state: 'blocked', registration, message: HOW_TO_REENABLE };
  const subscription = permissionState(env) === 'granted' ? await currentSubscription({ registration }) : null;
  // The browser may hold a subscription that was registered for another account. With a client, "on" means this account
  // has a saved row for it (row level security only shows the signed-in owner's rows).
  if (subscription && client?.from) {
    try {
      const found = await client.from(PUSH_TABLE).select('endpoint').eq('endpoint', subscription.endpoint).limit(1);
      if (!found?.error && Array.isArray(found?.data) && found.data.length === 0) {
        return { state: 'off', registration, message: 'Push notifications are off for this account on this device.' };
      }
    } catch { /* could not check: keep what the browser says */ }
  }
  return subscription
    ? { state: 'on', registration, message: 'Push notifications are on for this device.' }
    : { state: 'off', registration, message: 'Push notifications are off for this device.' };
}
