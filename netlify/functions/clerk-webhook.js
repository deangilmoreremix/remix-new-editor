// netlify/functions/clerk-webhook.js
//
// Clerk webhook receiver. Verifies the Svix signature on incoming Clerk events
// using CLERK_WEBHOOK_SIGNING_SECRET, then best-effort syncs the user into the
// Supabase `public.users` table.
//
// Register this endpoint in the Clerk dashboard (Webhooks -> Add Endpoint):
//   URL:    https://<your-site>/.netlify/functions/clerk-webhook
//   Secret: the same value as CLERK_WEBHOOK_SIGNING_SECRET
//   Events: user.created, user.updated, user.deleted
//
// Note: a webhook is independent of the sign-in flow — it only keeps your
// backend user records in sync after a user signs in/up. Sign-in itself is
// handled entirely client-side by @clerk/react (see src/components/auth/ClerkAuth.jsx).

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
const TOLERANCE_MS = 5 * 60 * 1000; // reject events older/newer than 5 minutes

// Case-insensitive header lookup (Netlify may lowercase header keys).
function getHeader(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

// Verify the Svix signature of a Clerk webhook.
// Returns true when the signature is valid and within the time tolerance.
function verifySvix(body, headers) {
  if (!WEBHOOK_SECRET) {
    console.error('[clerk-webhook] CLERK_WEBHOOK_SIGNING_SECRET is not set');
    return false;
  }

  const id =
    getHeader(headers, 'svix-id') ||
    getHeader(headers, 'webhook-id');
  const timestamp =
    getHeader(headers, 'svix-timestamp') ||
    getHeader(headers, 'webhook-timestamp');
  const signatures =
    getHeader(headers, 'svix-signature') ||
    getHeader(headers, 'webhook-signature');

  if (!id || !timestamp || !signatures) {
    console.error('[clerk-webhook] Missing Svix headers');
    return false;
  }

  // Reject replays / stale events.
  const ts = Number(timestamp) * 1000;
  if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > TOLERANCE_MS) {
    console.error('[clerk-webhook] Timestamp outside tolerance');
    return false;
  }

  // whsec_... is a base64-encoded raw key.
  const key = Buffer.from(WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${timestamp}.${body}`;
  const expected = crypto
    .createHmac('sha256', key)
    .update(signedContent)
    .digest('hex');

  // Signatures are comma-separated "v1,<hex>" entries; any match is accepted.
  const provided = signatures.split(',').map((s) => s.trim().replace(/^v1,/, ''));
  const valid = provided.some((sig) => {
    if (sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });

  if (!valid) console.error('[clerk-webhook] Signature mismatch');
  return valid;
}

// Best-effort upsert of the Clerk user into Supabase. Failures are logged but
// do not break the webhook (Clerk only needs a 2xx to consider delivery successful).
async function syncUser(eventType, data) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.log('[clerk-webhook] Supabase not configured — skipping DB sync');
    return;
  }

  const supabase = createClient(url, serviceKey);
  const clerkId = data.id;

  if (eventType === 'user.deleted') {
    const { error } = await supabase.from('users').delete().eq('clerk_id', clerkId);
    if (error) console.error('[clerk-webhook] delete failed:', error.message);
    return;
  }

  const primaryEmail = data.email_addresses?.find(
    (e) => e.id === data.primary_email_address_id
  )?.email_address;
  const name =
    [data.first_name, data.last_name].filter(Boolean).join(' ') || data.username || null;

  const { error } = await supabase.from('users').upsert(
    {
      clerk_id: clerkId,
      email: primaryEmail ?? null,
      name,
      image_url: data.image_url ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'clerk_id' }
  );

  if (error) console.error('[clerk-webhook] upsert failed:', error.message);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const body = typeof event.body === 'string' ? event.body : event.body?.toString?.() ?? '';

  if (!verifySvix(body, event.headers)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) };
  }

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  try {
    await syncUser(payload.type, payload.data || {});
  } catch (err) {
    console.error('[clerk-webhook] sync error:', err.message);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
