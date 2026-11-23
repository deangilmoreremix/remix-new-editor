/**
 * Resend e-mail adapter + Clerk recipient lookup (see emailAdapter.js for the adapter contract).
 * Nothing here logs addresses, tokens or message bodies; error strings are short codes.
 */
const RESEND_URL = 'https://api.resend.com/emails';
const CLERK_USERS_URL = 'https://api.clerk.com/v1/users/';
const HTTP_TIMEOUT_MS = 8000;
const EMAIL_SHAPE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** `read(res)` (optional) runs while the deadline is still active, so a response whose body stalls is aborted too. */
async function timedFetch(fetchImpl, url, init, timeoutMs, read) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: ctrl.signal });
    return read ? await read(res) : res;
  } finally { clearTimeout(timer); }
}

/** Returned (instead of null) when the lookup failed for a reason that may pass: the row must be retried, not skipped. */
export const RECIPIENT_TRANSIENT = Object.freeze({ transient: true });

/**
 * The owner's PRIMARY, VERIFIED e-mail from the Clerk Backend API; null when there is none (no key, unknown user,
 * no primary, unverified, a rejected request); RECIPIENT_TRANSIENT when Clerk could not be asked right now
 * (HTTP 429/5xx, timeout, network error). Never takes an address from a request or from a user-editable field.
 */
export async function lookupClerkEmail({ ownerId, secret, fetchImpl, timeoutMs = HTTP_TIMEOUT_MS }) {
  if (!secret || typeof ownerId !== 'string' || !/^[\w-]{1,128}$/.test(ownerId)) return null;
  try {
    const out = await timedFetch(fetchImpl, `${CLERK_USERS_URL}${encodeURIComponent(ownerId)}`, { headers: { Authorization: `Bearer ${secret}` } }, timeoutMs,
      async (res) => (res.ok ? { user: await res.json() } : { status: res.status }));
    if (out.status !== undefined) return out.status === 429 || out.status >= 500 ? RECIPIENT_TRANSIENT : null;
    const user = out.user;
    const primary = (user?.email_addresses || []).find((e) => e?.id && e.id === user?.primary_email_address_id);
    const address = primary?.verification?.status === 'verified' ? String(primary.email_address || '').trim() : '';
    return EMAIL_SHAPE.test(address) ? address : null;
  } catch { return RECIPIENT_TRANSIENT; } // timeout, network error or an unreadable body
}

export function createResendAdapter({ apiKey, from, clerkSecret, fetchImpl = globalThis.fetch, timeoutMs = HTTP_TIMEOUT_MS }) {
  const recipients = new Map(); // lives as long as this adapter, i.e. one invocation: no cross-request cache
  return {
    name: 'resend',
    configured: true,
    resolveRecipient(ownerId) {
      if (!recipients.has(ownerId)) recipients.set(ownerId, lookupClerkEmail({ ownerId, secret: clerkSecret, fetchImpl, timeoutMs }));
      return recipients.get(ownerId);
    },
    async send({ to, subject, text, html, idempotencyKey }) {
      try {
        const res = await timedFetch(fetchImpl, RESEND_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey).slice(0, 256) } : {}) },
          body: JSON.stringify({ from, to: [to], subject, text, ...(html ? { html } : {}) }),
        }, timeoutMs);
        if (res.ok) return { ok: true };
        return { ok: false, error: `resend_http_${res.status}`, retryable: res.status === 429 || res.status >= 500 };
      } catch (err) {
        return { ok: false, error: err?.name === 'AbortError' ? 'resend_timeout' : 'resend_network_error', retryable: true };
      }
    },
  };
}
