/**
 * Resend e-mail adapter + Clerk recipient lookup (see emailAdapter.js for the adapter contract).
 * Nothing here logs addresses, tokens or message bodies; error strings are short codes.
 */
const RESEND_URL = 'https://api.resend.com/emails';
const CLERK_USERS_URL = 'https://api.clerk.com/v1/users/';
const HTTP_TIMEOUT_MS = 8000;
const EMAIL_SHAPE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

async function timedFetch(fetchImpl, url, init, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetchImpl(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(timer); }
}

/**
 * The owner's PRIMARY, VERIFIED e-mail from the Clerk Backend API, or null (no key, unknown user, no primary,
 * unverified, any error). Never takes an address from a request or from a user-editable field.
 */
export async function lookupClerkEmail({ ownerId, secret, fetchImpl, timeoutMs = HTTP_TIMEOUT_MS }) {
  if (!secret || typeof ownerId !== 'string' || !/^[\w-]{1,128}$/.test(ownerId)) return null;
  try {
    const res = await timedFetch(fetchImpl, `${CLERK_USERS_URL}${encodeURIComponent(ownerId)}`, { headers: { Authorization: `Bearer ${secret}` } }, timeoutMs);
    if (!res.ok) return null;
    const user = await res.json();
    const primary = (user?.email_addresses || []).find((e) => e?.id && e.id === user?.primary_email_address_id);
    const address = primary?.verification?.status === 'verified' ? String(primary.email_address || '').trim() : '';
    return EMAIL_SHAPE.test(address) ? address : null;
  } catch { return null; }
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
