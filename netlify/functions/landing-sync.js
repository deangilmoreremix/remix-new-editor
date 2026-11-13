/* global AbortSignal */
// netlify/functions/landing-sync.js
//
// Push video-page contacts (with their personal link) to the user's own
// MailerLite account, so their email template can use the link.
//
//   POST { action: 'check' }                              -> { ok, provider }
//   POST { action: 'groups' }                             -> { ok, groups: [{ id, name }] }
//   POST { action: 'push', groupId?, contacts: [...] }    -> { ok, pushed, failed, rateLimited, field }
//     contact: { email, firstname?, lastname?, company?, link? }
//
// BYOK like timeline-ai.js: the browser sends the user's MailerLite token per
// request as X-MailerLite-Key; it is used for that request only and is never
// logged or stored. Requests go only to the fixed MailerLite API host, so the
// function can't be pointed at other services. Endpoints and fields verified
// against developers.mailerlite.com (subscribers upsert, fields, groups).
//
// Kit is NOT implemented: its API docs could not be verified from the build
// environment, and provider code is not shipped unverified.

import { withClerkAuth } from './_shared/clerkAuth.js';
import { userMailerLiteKey, NEED_MAILERLITE_KEY, BAD_MAILERLITE_KEY } from './_shared/byok.js';

const API = 'https://connect.mailerlite.com/api';
export const LINK_FIELD_NAME = 'video page url';
export const MAX_CONTACTS = 200;
const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const GROUP_ID = /^\d{1,24}$/;
const CONCURRENCY = 3;

const json = (statusCode, body) => ({ statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const fail = (statusCode, code, message) => json(statusCode, { ok: false, error: { code, message } });

class ProviderError extends Error {
  constructor(status, message, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function ml(path, { key, method = 'GET', body, fetchImpl = fetch }) {
  const res = await fetchImpl(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || `MailerLite error (HTTP ${res.status})`;
    throw new ProviderError(res.status, message, Number(res.headers?.get?.('retry-after')) || undefined);
  }
  return data;
}

/** Find the "video page url" field, creating it once. Returns its key. */
async function ensureLinkField(ctx) {
  const list = await ml('/fields?limit=200', ctx);
  const existing = (list.data || []).find((f) => String(f.name).toLowerCase() === LINK_FIELD_NAME);
  if (existing?.key) return existing.key;
  const created = await ml('/fields', { ...ctx, method: 'POST', body: { name: LINK_FIELD_NAME, type: 'text' } });
  return created?.data?.key || null;
}

const clean = (v, n = 200) => String(v ?? '').trim().slice(0, n);

/** Subscriber upsert body for one contact (exported for tests). */
export function subscriberBody(contact, { linkKey, groupId }) {
  const fields = {};
  if (clean(contact.firstname)) fields.name = clean(contact.firstname);
  if (clean(contact.lastname)) fields.last_name = clean(contact.lastname);
  if (clean(contact.company)) fields.company = clean(contact.company);
  if (linkKey && /^https:\/\//i.test(String(contact.link || ''))) fields[linkKey] = clean(contact.link, 2048);
  const body = { email: clean(contact.email, 320), fields };
  if (groupId) body.groups = [groupId];
  return body;
}

export async function handle(body, { key, fetchImpl = fetch } = {}) {
  if (!key) return fail(401, 'need_key', NEED_MAILERLITE_KEY);
  const ctx = { key, fetchImpl };
  try {
    if (body.action === 'check') {
      await ml('/groups?limit=1', ctx);
      return json(200, { ok: true, provider: 'mailerlite' });
    }

    if (body.action === 'groups') {
      const res = await ml('/groups?limit=100&sort=name', ctx);
      return json(200, { ok: true, groups: (res.data || []).map((g) => ({ id: String(g.id), name: clean(g.name, 120) })) });
    }

    if (body.action === 'push') {
      const groupId = body.groupId == null || body.groupId === '' ? null : String(body.groupId);
      if (groupId && !GROUP_ID.test(groupId)) return fail(400, 'bad_request', 'Invalid group');
      const input = Array.isArray(body.contacts) ? body.contacts : null;
      if (!input || !input.length) return fail(400, 'bad_request', 'No contacts to send');
      if (input.length > MAX_CONTACTS) return fail(400, 'too_many', `Send at most ${MAX_CONTACTS} contacts per request`);

      const failed = [];
      const valid = [];
      input.forEach((c, index) => {
        if (!c || !EMAIL.test(clean(c.email, 320))) failed.push({ index, reason: 'invalid email' });
        else valid.push({ index, contact: c });
      });

      const linkKey = valid.some(({ contact }) => contact.link) ? await ensureLinkField(ctx) : null;

      let pushed = 0;
      let rateLimited = false;
      let retryAfter;
      let cursor = 0;
      const worker = async () => {
        while (cursor < valid.length && !rateLimited) {
          const { index, contact } = valid[cursor++];
          try {
            await ml('/subscribers', { ...ctx, method: 'POST', body: subscriberBody(contact, { linkKey, groupId }) });
            pushed += 1;
          } catch (err) {
            if (err.status === 429) { rateLimited = true; retryAfter = err.retryAfter; failed.push({ index, reason: 'rate limited' }); }
            else if (err.status === 401 || err.status === 403) throw err;
            else failed.push({ index, reason: err.message || 'rejected' });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, valid.length) }, worker));
      // Contacts never attempted because we stopped on a rate limit.
      if (rateLimited) valid.slice(cursor).forEach(({ index }) => failed.push({ index, reason: 'not sent (rate limited)' }));

      return json(200, { ok: true, pushed, failed, rateLimited, retryAfter: retryAfter ?? null, field: linkKey });
    }

    return fail(400, 'bad_request', 'Unknown action');
  } catch (err) {
    if (err instanceof ProviderError && (err.status === 401 || err.status === 403)) return fail(401, 'bad_key', BAD_MAILERLITE_KEY);
    if (err instanceof ProviderError && err.status === 429) return fail(429, 'rate_limited', 'MailerLite is rate limiting requests. Wait a minute and try again.');
    return fail(502, 'provider_error', err?.message || 'MailerLite request failed');
  }
}

export const handler = withClerkAuth(async (event) => {
  if (event.httpMethod !== 'POST') return fail(405, 'method_not_allowed', 'Use POST');
  if ((event.body || '').length > 300_000) return fail(413, 'too_large', 'Request too large');
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return fail(400, 'bad_request', 'Body must be JSON'); }
  return handle(body, { key: userMailerLiteKey(event.headers) });
});
