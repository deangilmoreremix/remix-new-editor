/**
 * Browser side of the MailerLite sync (netlify/functions/landing-sync.js).
 * The user's MailerLite token stays in this browser (localStorage) and is sent
 * per request over HTTPS; the server never stores it (BYOK, like the other
 * paid-API functions). Mappers and batching are pure so they can be tested.
 */
import { personalUrl } from './client.js';

const KEY_STORE = 'sv_mailerlite_token';
export const BATCH_SIZE = 200; // must match MAX_CONTACTS in the function

export function getSyncKey(storage = globalThis.localStorage) {
  try { return storage.getItem(KEY_STORE) || ''; } catch { return ''; }
}
export function setSyncKey(value, storage = globalThis.localStorage) {
  try {
    if (value) storage.setItem(KEY_STORE, String(value).trim());
    else storage.removeItem(KEY_STORE);
  } catch { /* private mode: key just isn't remembered */ }
}

async function authHeader() {
  try {
    const token = await globalThis.window?.Clerk?.session?.getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/** POST an action to the sync function. Throws Error(message) on any failure. */
export async function callSync(action, payload = {}, { key = getSyncKey(), fetchImpl = globalThis.fetch } = {}) {
  const res = await fetchImpl('/api/landing-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()), ...(key ? { 'X-MailerLite-Key': key } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data?.error?.message || data?.error || `Sync failed (HTTP ${res.status})`);
  return data;
}

/** Page contacts that have an email -> rows for the sync function, each with its personal link. */
export function contactsToPush(contacts, pageId, origin) {
  return contacts
    .filter((c) => c.fields?.email)
    .map((c) => ({
      email: c.fields.email,
      firstname: c.fields.firstname || '',
      lastname: c.fields.lastname || '',
      company: c.fields.company || '',
      link: personalUrl(pageId, c.id, origin),
    }));
}

/** Lead-form submissions (video_leads rows) that include an email -> rows for the sync function. */
export function leadsToPush(leads) {
  const seen = new Set();
  const out = [];
  leads.forEach((l) => {
    const d = l?.data || {};
    const email = String(d.email || '').trim();
    if (!email || seen.has(email.toLowerCase())) return;
    seen.add(email.toLowerCase());
    const [first, ...rest] = String(d.name || d.firstname || '').trim().split(/\s+/);
    out.push({ email, firstname: first || '', lastname: d.lastname || rest.join(' '), company: d.company || '' });
  });
  return out;
}

/**
 * Send rows in function-sized batches. Stops at the first rate limit and
 * reports how many were sent and which were not.
 * @returns {{ pushed: number, failed: {index:number, reason:string}[], rateLimited: boolean, retryAfter: number|null }}
 */
export async function pushInBatches(rows, { groupId = null, push = (p) => callSync('push', p), onProgress } = {}) {
  let pushed = 0;
  const failed = [];
  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const batch = rows.slice(start, start + BATCH_SIZE);
    const res = await push({ groupId, contacts: batch });
    pushed += res.pushed || 0;
    (res.failed || []).forEach((f) => failed.push({ index: start + f.index, reason: f.reason }));
    onProgress?.(Math.min(start + BATCH_SIZE, rows.length), rows.length);
    if (res.rateLimited) {
      // Everything after this batch was never attempted.
      for (let i = start + BATCH_SIZE; i < rows.length; i += 1) failed.push({ index: i, reason: 'not sent (rate limited)' });
      return { pushed, failed, rateLimited: true, retryAfter: res.retryAfter ?? null };
    }
  }
  return { pushed, failed, rateLimited: false, retryAfter: null };
}
