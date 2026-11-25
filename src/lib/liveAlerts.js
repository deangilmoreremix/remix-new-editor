// src/lib/liveAlerts.js
//
// Live video alerts: new rows in owner_notifications ("Mike Ross is watching your video") arrive the
// moment they are written, over Supabase Realtime (a WebSocket). Row-level security sends each owner
// only their own rows, using the same Clerk-minted Supabase token the app's requests carry. One
// connection per page, shared by every listener (the header bell, the campaign's activity list). The
// bell's timed refresh stays as the backup, so nothing is lost if the connection drops.

const REAUTH_MS = 10 * 60 * 1000;
const listeners = new Set();
let state = null; // { client, channel, timer }
let starting = null;

async function defaultDeps() {
  const { rawClient, primeSupabaseIdentity } = await import('./supabase.js');
  return { client: rawClient, prime: (c) => primeSupabaseIdentity(c) };
}
let depsLoader = defaultDeps;
/** Test hook. */
export function _setLiveAlertDeps(fn) { stop(); depsLoader = fn || defaultDeps; }

function emit(row) { for (const fn of [...listeners]) { try { fn(row); } catch { /* one listener must not break the others */ } } }

/** Connect if there are listeners and the owner is signed in (no-op when already connected). */
export function ensureLiveAlerts() {
  if (state || starting || !listeners.size) return starting || Promise.resolve(!!state);
  starting = (async () => {
    const { client, prime } = await depsLoader();
    if (!client?.channel || !client?.realtime?.setAuth) return false;
    const token = await prime(client);
    if (!token || !listeners.size) return false; // signed out: try again on the next ensure
    client.realtime.setAuth(token);
    const channel = client.channel('owner-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'owner_notifications' }, (payload) => emit(payload?.new || {}))
      .subscribe();
    // The token expires: refresh it on the connection now and then.
    const timer = setInterval(async () => { try { const t = await prime(client); if (t) client.realtime.setAuth(t); } catch { /* next time */ } }, REAUTH_MS);
    state = { client, channel, timer };
    return true;
  })().catch(() => false).finally(() => { starting = null; });
  return starting;
}

function stop() {
  if (!state) return;
  clearInterval(state.timer);
  try { state.client.removeChannel?.(state.channel); } catch { /* already gone */ }
  state = null;
}

/** Listen for new alerts. Returns a function that stops listening (the connection closes with the last one). */
export function onOwnerNotification(fn) {
  listeners.add(fn);
  ensureLiveAlerts();
  return () => {
    listeners.delete(fn);
    if (!listeners.size) stop();
  };
}

/** True when a row is a Video Outreach alert for this campaign (see the outreach_alerts migrations). */
export function isOutreachAlertFor(row, campaignId) {
  return !!campaignId && row?.video_id === campaignId && String(row?.dedupe_key || '').startsWith(`outreach:${campaignId}:`);
}
