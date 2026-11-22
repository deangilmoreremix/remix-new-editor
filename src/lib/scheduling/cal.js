// src/lib/scheduling/cal.js
//
// Scheduling for every user, with no second login. Each person gets their own Cal.diy account the first time they open
// Scheduling: this app hands Cal.diy the person's own Clerk session token (verified there against Clerk's public keys,
// see apps/cal-diy/UPSTREAM.md "SSO bridge"), and Cal.diy signs them in and creates their account.
//
// Cal.diy runs on a Beam VM that sleeps when idle, so opening Scheduling first wakes it, then mints a fresh token
// (Clerk session tokens live about a minute, so the token is made only once Cal.diy is answering).

const DEFAULT_CAL_HOST = 'https://cal-diy-27e9c22ceae94d01b54867c2a3aaed1a-3000.app.beam.cloud';

/** Where Cal.diy runs. Set VITE_CAL_HOST to move it (a custom domain, another host). https, or http for local testing. */
export function calHost(env = (typeof import.meta !== 'undefined' ? import.meta.env : undefined)) {
  const raw = String(env?.VITE_CAL_HOST || DEFAULT_CAL_HOST).trim().replace(/\/+$/, '');
  try {
    const u = new URL(raw);
    const local = u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname);
    return (u.protocol === 'https:' || local) && !u.username && !u.password ? u.origin : '';
  } catch {
    return '';
  }
}

/**
 * The Cal.diy username for a Clerk user id. Must match `ssoUsernameFor` in cal-diy
 * (apps/cal-diy/packages/features/auth/lib/ssoBridge.ts): `u-` + the id without `user_`, lowercased, letters and digits, 20 max.
 */
export function calUsernameFor(clerkId) {
  const core = String(clerkId || '').replace(/^user_/i, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  return core ? `u-${core}` : '';
}

/** A person's booking link on Cal.diy, e.g. `u-2abc/30min`. '' when there is no signed-in user. */
export function myCalLink(clerkId, slug = '30min') {
  const user = calUsernameFor(clerkId);
  return user && /^[a-z0-9-]{1,40}$/.test(slug) ? `${user}/${slug}` : '';
}

/** What a new Booking calendar section on a page should start with, for the signed-in user. */
export function bookingDefaults(clerkId, env) {
  const host = calHost(env);
  const link = myCalLink(clerkId);
  return host && link ? { host, link } : null;
}

/**
 * Wakes Cal.diy and waits until it answers. A no-cors request resolves for any HTTP answer (even an error page) and
 * fails only while nothing is listening, so "resolved" means the server is up.
 */
export async function wakeCal({ host = calHost(), fetchImpl = globalThis.fetch, timeoutMs = 150000, intervalMs = 2500, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now(), onTick } = {}) {
  if (!host) throw new Error('Scheduling is not set up yet.');
  const started = now();
  for (;;) {
    try {
      const res = await fetchImpl(`${host}/api/auth/providers`, { mode: 'no-cors', cache: 'no-store' });
      // Beam answers 502/503 style pages while the VM is still starting: those are "not up yet".
      if (!res || res.type === 'opaque' || (res.status && res.status < 500)) return true;
    } catch {
      // not listening yet
    }
    if (now() - started > timeoutMs) throw new Error('Scheduling is taking too long to start. Try again in a minute.');
    onTick?.(now() - started);
    await sleep(intervalMs);
  }
}

/** The address that signs the person in and lands them on `next` (a path inside Cal.diy). The token is in the fragment. */
export function schedulingUrl(token, next = '/availability', host = calHost()) {
  const path = /^\/(?!\/)[A-Za-z0-9\-._~!$&'()*+,;=:@%/?#]*$/.test(String(next)) ? String(next) : '/event-types';
  return `${host}/auth/sso#token=${encodeURIComponent(token)}&next=${encodeURIComponent(path)}`;
}

/**
 * Opens Scheduling for the signed-in person in a new tab. The tab is opened straight away (inside the click, so pop-up
 * blockers allow it) and pointed at Cal.diy once it is awake and a fresh token exists.
 */
export async function openScheduling({ next = '/availability', onStatus, win = globalThis.window, host = calHost(), wake = wakeCal } = {}) {
  const clerk = win?.Clerk;
  if (!clerk?.session?.getToken) throw new Error('Sign in to use Scheduling.');
  const tab = win.open('about:blank', '_blank');
  try {
    if (tab && tab.document) tab.document.title = 'Opening Scheduling…';
    onStatus?.('Starting Scheduling…');
    await wake({ host });
    const token = await clerk.session.getToken();
    if (!token) throw new Error('Sign in again to use Scheduling.');
    const url = schedulingUrl(token, next, host);
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      win.location.assign(url);
    }
    onStatus?.('');
  } catch (err) {
    try { tab?.close(); } catch { /* already closed */ }
    onStatus?.('');
    throw err;
  }
}
