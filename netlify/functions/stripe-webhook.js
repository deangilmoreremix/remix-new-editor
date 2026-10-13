// netlify/functions/stripe-webhook.js
//
// Stripe webhook receiver — closes the Stripe -> entitlement loop.
//
// The landing page sells SmartVideo AI through raw Stripe Payment Links
// (src/components/landing/sections/OfferSection.jsx navigates straight to
// buy.stripe.com URLs) and, before this function, nothing connected a
// completed Stripe purchase to the Clerk entitlement that gates the app.
// Clerk is the entitlement source of truth: full access is either the Clerk
// Billing feature "smartvideo_full_access" or publicMetadata.legacy_access
// === true (src/lib/clerkEntitlements.js). This webhook is therefore the only
// server-side writer of the legacy_access flag.
//
// Setup:
//   Stripe dashboard -> Developers -> Webhooks -> Add endpoint
//     URL:    https://<your-site>/.netlify/functions/stripe-webhook
//     Events: checkout.session.completed, payment_intent.succeeded,
//             charge.refunded
//   Copy the endpoint signing secret into STRIPE_WEBHOOK_SECRET (Netlify env).
//
// Handler style: this file follows the repo convention used by
// netlify/functions/clerk-webhook.js (`export const handler` returning
// { statusCode, body }), which the Netlify Functions runtime (2.x) serves.
// A `default` export wraps the same handler in the 2.x Web Request/Response
// API so the function behaves identically under either invocation style.
//
// Env (server-only; see .env.example):
//   STRIPE_SECRET_KEY             Stripe API key. Required — the handler fails
//                                 closed (500) without it.
//   STRIPE_WEBHOOK_SECRET         Signing secret used for verification.
//   CLERK_SECRET_KEY              Clerk backend access for grant/revoke.
//   STRIPE_PRICE_ENTITLEMENT_MAP  Optional JSON {"<price_id>":"<entitlement>"}.
//   STRIPE_DEFAULT_ENTITLEMENT    Fallback entitlement key when the price
//                                 cannot be resolved. Defaults to
//                                 "legacy_access"; set it to an empty string
//                                 to disable the fallback so unresolvable
//                                 purchases are logged and ignored.
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//                                 Optional. Pending-grant ledger (users
//                                 table, same table clerk-webhook.js syncs)
//                                 and the optional stripe_events dedupe
//                                 table. Both are best-effort: without
//                                 Supabase the webhook still grants/revokes
//                                 through Clerk and only logs the ledger gap.
//                                 SUPABASE_SERVICE_KEY is accepted as an
//                                 alias for SUPABASE_SERVICE_ROLE_KEY.
//
// Decision table:
//   event                       | outcome
//   --------------------------- | -------------------------------------------
//   checkout.session.completed  | grant legacy_access=true (skipped when a
//                               | newer charge.refunded already revoked it)
//   payment_intent.succeeded    | grant only when not already granted for the
//                               | same purchase — with the app's single
//                               | "full access" entitlement semantic that is
//                               | exactly the idempotent no-op
//   charge.refunded             | revoke: legacy_access=false plus
//                               | legacy_access_revoked_at (event time)
//   any other event             | log + 200 (a webhook must never crash)
//
// Entitlement key resolution (first hit wins):
//   1. session/charge metadata.entitlement
//   2. price id via STRIPE_PRICE_ENTITLEMENT_MAP (checkout line items are not
//      part of the webhook payload for Payment Links, so the session is
//      re-fetched with line_items expanded when needed)
//   3. STRIPE_DEFAULT_ENTITLEMENT (default "legacy_access")
//   Nothing resolves -> log loudly + 200, no grant.
//
// Idempotency (no stripe_events table ships in supabase/migrations, and the
// supabase-js service client cannot run DDL, so the table is optional):
//   primary guard = in-request Clerk state check. A replayed
//   checkout.session.completed never re-grants after a refund: revokes stamp
//   legacy_access_revoked_at, and a grant whose event timestamp predates that
//   stamp is skipped, while a genuinely newer purchase still re-grants.
//   secondary = best-effort upsert into a stripe_events table keyed by event
//   id when that table exists. Recommended DDL:
//     CREATE TABLE IF NOT EXISTS stripe_events (
//       event_id text PRIMARY KEY,
//       event_type text NOT NULL,
//       created_at timestamptz NOT NULL,
//       processed_at timestamptz NOT NULL DEFAULT now(),
//       payload jsonb NOT NULL DEFAULT '{}'::jsonb
//     );
//   Missing table / query error -> skip gracefully and rely on the primary
//   guard.

import { createClerkClient } from '@clerk/backend';
import Stripe from 'stripe';

const LOG_PREFIX = '[stripe-webhook]';

// Documented fallback entitlement key — matches the Clerk metadata flag the
// frontend entitlement check reads (src/lib/clerkEntitlements.js).
const DEFAULT_ENTITLEMENT = 'legacy_access';

// Optional best-effort dedupe table (see the header for the recommended DDL).
const STRIPE_EVENTS_TABLE = 'stripe_events';

function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

function warnLog(...args) {
  console.warn(LOG_PREFIX, ...args);
}

function errorLog(...args) {
  console.error(LOG_PREFIX, ...args);
}

// Case-insensitive header lookup — Netlify may lowercase incoming header keys.
function getHeader(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

// Netlify delivers the request body as a string; base64-encoded payloads set
// event.isBase64Encoded and must be decoded first, because the Stripe
// signature covers the raw request bytes.
function getRawBody(event) {
  if (event.body == null) return '';
  const raw = typeof event.body === 'string' ? event.body : String(event.body);
  return event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
}

function envValue(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function jsonResponse(statusCode, payload) {
  return { statusCode, body: JSON.stringify(payload) };
}

function isoFromUnixSeconds(seconds) {
  if (typeof seconds === 'number' && Number.isFinite(seconds)) {
    return new Date(seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

// Operator-configured price -> entitlement map (JSON). Invalid JSON is logged
// and treated as an empty map so one bad deploy cannot crash the webhook.
function getPriceEntitlementMap() {
  const raw = envValue('STRIPE_PRICE_ENTITLEMENT_MAP');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch (err) {
    errorLog('STRIPE_PRICE_ENTITLEMENT_MAP is not valid JSON — price mapping disabled:', err.message);
    return {};
  }
}

// Customer email across the three object shapes handled here:
//   checkout.session.completed -> customer_details.email | customer_email
//   payment_intent.succeeded   -> receipt_email | charges[].billing_details.email
//   charge.refunded            -> billing_details.email | receipt_email
function extractEmail(object) {
  return object?.customer_details?.email
    || object?.customer_email
    || object?.receipt_email
    || object?.billing_details?.email
    || object?.charges?.data?.[0]?.billing_details?.email
    || null;
}

// Payment Link checkouts do not carry line items in the webhook payload, so
// the session is re-fetched with line_items expanded when neither the payload
// nor the session metadata names the price.
async function listPriceIds(stripe, object) {
  const ids = [];
  const metadataPriceId = object?.metadata?.price_id;
  if (metadataPriceId) ids.push(metadataPriceId);
  const displayPriceId = object?.display_items?.find((item) => item?.price?.id)?.price?.id;
  if (displayPriceId) ids.push(displayPriceId);
  if (ids.length > 0 || object?.object !== 'checkout.session' || !object?.id) return ids;

  try {
    const session = await stripe.checkout.sessions.retrieve(object.id, { expand: ['line_items'] });
    const linePriceIds = (session?.line_items?.data || [])
      .map((item) => item?.price?.id)
      .filter(Boolean);
    ids.push(...linePriceIds);
  } catch (err) {
    errorLog(`line_items lookup failed for session ${object.id} (${err.message}) `
      + '— falling back to the metadata/default entitlement');
  }
  return ids;
}

// Entitlement key resolution: metadata.entitlement -> price map -> default
// fallback. Returns null only when resolution genuinely fails.
function resolveEntitlementKey(object, priceIds) {
  const fromMetadata = object?.metadata?.entitlement;
  if (typeof fromMetadata === 'string' && fromMetadata.trim()) {
    return { key: fromMetadata.trim(), source: 'metadata.entitlement' };
  }

  const map = getPriceEntitlementMap();
  const matchedPriceId = priceIds.find((id) => Object.prototype.hasOwnProperty.call(map, id));
  if (matchedPriceId) {
    return { key: String(map[matchedPriceId]), source: `price_map:${matchedPriceId}` };
  }

  // Unset -> documented default ("legacy_access"). Explicitly set to an empty
  // string -> fail closed: unresolvable purchases are logged and ignored.
  const fallback = process.env.STRIPE_DEFAULT_ENTITLEMENT === undefined
    ? DEFAULT_ENTITLEMENT
    : process.env.STRIPE_DEFAULT_ENTITLEMENT.trim();
  if (fallback) return { key: fallback, source: 'STRIPE_DEFAULT_ENTITLEMENT' };

  errorLog('unresolvable entitlement: no metadata.entitlement, no price map match, no fallback');
  return null;
}

// Supabase is OPTIONAL (ledger/dedupe only). It is loaded lazily so that a
// bundling or module-resolution problem in @supabase/supabase-js (observed as
// Runtime.ImportModuleError on a missing transitive dep in a partial tree)
// cannot take down the whole webhook — grants only need Stripe + Clerk. Never
// throws: returns null when unavailable, which every caller handles.
async function createSupabaseFromEnv() {
  const url = envValue('SUPABASE_URL');
  const serviceKey = envValue('SUPABASE_SERVICE_ROLE_KEY') || envValue('SUPABASE_SERVICE_KEY');
  if (!url || !serviceKey) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    return createClient(url, serviceKey);
  } catch (err) {
    errorLog('supabase-js unavailable, continuing without ledger/dedupe:', err?.message || err);
    return null;
  }
}

// Existing Clerk users only — this webhook never creates users.
async function findClerkUserByEmail(clerkClient, email) {
  const result = await clerkClient.users.getUserList({ emailAddress: [email] });
  const users = Array.isArray(result) ? result : (result?.data || []);
  if (users.length > 1) {
    warnLog(`${users.length} Clerk users match ${email} — using the first`);
  }
  return users[0] || null;
}

// In-request Clerk-state guard. Returns a skip reason, or null to proceed.
// A replayed grant (event predating the refund that revoked access) is
// skipped; a genuinely newer purchase re-grants.
function grantSkipReason(user, event) {
  const metadata = user?.publicMetadata || {};
  if (metadata.legacy_access === true) return 'user already has legacy_access';
  if (metadata.legacy_access === false && metadata.legacy_access_revoked_at) {
    const revokedAtMs = new Date(metadata.legacy_access_revoked_at).getTime();
    const eventMs = typeof event?.created === 'number' ? event.created * 1000 : NaN;
    if (Number.isFinite(revokedAtMs) && Number.isFinite(eventMs) && eventMs <= revokedAtMs) {
      return 'grant event predates the refund revocation (replay)';
    }
  }
  return null;
}

// Best-effort dedupe: true when this event id was already processed. A missing
// stripe_events table (or any query error) degrades to false — the
// Clerk-state guard is the primary idempotency mechanism.
async function isDuplicateEvent(supabase, event) {
  if (!supabase || !event?.id) return false;
  try {
    const { data, error } = await supabase
      .from(STRIPE_EVENTS_TABLE)
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();
    if (error) {
      warnLog(`stripe_events lookup unavailable (${error.message}) — using the Clerk state guard`);
      return false;
    }
    return Boolean(data);
  } catch (err) {
    warnLog(`stripe_events lookup failed (${err.message}) — using the Clerk state guard`);
    return false;
  }
}

async function recordProcessedEvent(supabase, event) {
  if (!supabase || !event?.id) return;
  try {
    const { error } = await supabase.from(STRIPE_EVENTS_TABLE).upsert({
      event_id: event.id,
      event_type: event.type,
      created_at: isoFromUnixSeconds(event.created),
      payload: event,
    }, { onConflict: 'event_id' });
    if (error) warnLog(`stripe_events upsert unavailable (${error.message})`);
  } catch (err) {
    warnLog(`stripe_events upsert failed (${err.message})`);
  }
}

// No Clerk account yet for this buyer. Record a pending grant in the same
// `users` table clerk-webhook.js syncs, keyed by `pending:<email>` so retries
// upsert instead of duplicating. A reconcile script finds these rows with
// clerk_id LIKE 'pending:%' and parses the entitlement key plus Stripe event
// id out of the `name` column: stripe_pending_grant:<entitlement>:<event_id>.
async function writePendingGrant(supabase, { email, entitlementKey, event }) {
  if (!supabase) {
    errorLog(`no Clerk user matches ${email} and Supabase is not configured — pending grant NOT recorded`);
    return;
  }
  try {
    const { error } = await supabase.from('users').upsert({
      clerk_id: `pending:${email}`,
      email,
      name: `stripe_pending_grant:${entitlementKey}:${event.id}`,
      image_url: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clerk_id' });
    if (error) {
      errorLog(`pending grant upsert failed for ${email}: ${error.message}`);
    } else {
      warnLog(`pending grant recorded for ${email} (${entitlementKey}) — awaiting Clerk signup for backfill`);
    }
  } catch (err) {
    errorLog(`pending grant upsert threw for ${email}: ${err.message}`);
  }
}

// grantEntitlement: checkout.session.completed and payment_intent.succeeded.
// Both are idempotent — an already-granted user is left untouched, and a
// replayed completed session never flips a newer refund back on.
async function grantEntitlement(stripe, clerkClient, supabase, event) {
  const object = event?.data?.object || {};
  const email = extractEmail(object);
  if (!email) {
    errorLog(`cannot grant: no customer email on ${event.type} ${event.id}`);
    return;
  }

  const priceIds = await listPriceIds(stripe, object);
  const entitlement = resolveEntitlementKey(object, priceIds);
  if (!entitlement) {
    errorLog(`grant skipped for ${event.id}: no entitlement key could be resolved for ${email}`);
    return;
  }

  if (await isDuplicateEvent(supabase, event)) {
    log(`ignoring duplicate delivery of ${event.id} (${event.type})`);
    return;
  }

  const user = await findClerkUserByEmail(clerkClient, email);
  if (!user) {
    warnLog(`no Clerk user matches ${email} — recording a pending grant for reconcile`);
    await writePendingGrant(supabase, { email, entitlementKey: entitlement.key, event });
    await recordProcessedEvent(supabase, event);
    return;
  }

  const skipReason = grantSkipReason(user, event);
  if (skipReason) {
    log(`grant skipped for ${email}: ${skipReason} (${event.id})`);
    await recordProcessedEvent(supabase, event);
    return;
  }

  await clerkClient.users.updateUser(user.id, {
    publicMetadata: {
      ...(user.publicMetadata || {}),
      legacy_access: true,
      entitlement_key: entitlement.key,
      entitlement_source: entitlement.source,
      granted_via: 'stripe',
      granted_event_id: event.id,
      granted_at: isoFromUnixSeconds(event.created),
    },
  });
  log(`granted ${entitlement.key} to ${email} via ${event.type} ${event.id}`);
  await recordProcessedEvent(supabase, event);
}

// revokeEntitlement: charge.refunded. Stamps the revocation time so a late
// replayed grant event can be recognised and skipped.
async function revokeEntitlement(clerkClient, supabase, event) {
  const object = event?.data?.object || {};
  const email = extractEmail(object);
  if (!email) {
    errorLog(`cannot revoke: no email on ${event.type} ${event.id}`);
    return;
  }

  if (await isDuplicateEvent(supabase, event)) {
    log(`ignoring duplicate delivery of ${event.id} (${event.type})`);
    return;
  }

  const user = await findClerkUserByEmail(clerkClient, email);
  if (!user) {
    log(`refund for ${email} has no Clerk user — nothing to revoke`);
    await recordProcessedEvent(supabase, event);
    return;
  }

  await clerkClient.users.updateUser(user.id, {
    publicMetadata: {
      ...(user.publicMetadata || {}),
      legacy_access: false,
      legacy_access_revoked_at: isoFromUnixSeconds(event.created),
      revoked_via: 'stripe',
      revoked_event_id: event.id,
    },
  });
  log(`revoked legacy_access for ${email} via ${event.type} ${event.id}`);
  await recordProcessedEvent(supabase, event);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Fail closed: without the Stripe secrets or the Clerk secret the webhook
  // can neither verify nor fulfill, so it must not acknowledge receipt.
  const stripeSecretKey = envValue('STRIPE_SECRET_KEY');
  const webhookSecret = envValue('STRIPE_WEBHOOK_SECRET');
  const clerkSecretKey = envValue('CLERK_SECRET_KEY');
  if (!stripeSecretKey || !webhookSecret || !clerkSecretKey) {
    errorLog('missing STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / CLERK_SECRET_KEY — failing closed');
    return jsonResponse(500, { error: 'Stripe webhook is not configured' });
  }

  const stripe = new Stripe(stripeSecretKey);
  const clerkClient = createClerkClient({ secretKey: clerkSecretKey });
  const supabase = await createSupabaseFromEnv();

  const signature = getHeader(event.headers, 'stripe-signature');
  if (!signature) {
    errorLog('missing stripe-signature header');
    return jsonResponse(400, { error: 'Missing signature' });
  }

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(getRawBody(event), signature, webhookSecret);
  } catch (err) {
    errorLog('signature verification failed:', err.message);
    return jsonResponse(400, { error: 'Invalid signature' });
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
      case 'payment_intent.succeeded':
        await grantEntitlement(stripe, clerkClient, supabase, stripeEvent);
        break;
      case 'charge.refunded':
        await revokeEntitlement(clerkClient, supabase, stripeEvent);
        break;
      default:
        log(`ignoring unhandled event type: ${stripeEvent.type}`);
    }
  } catch (err) {
    // Unexpected processing failure: 500 so Stripe retries the delivery.
    errorLog(`processing ${stripeEvent.type} ${stripeEvent.id} failed:`, err.message);
    return jsonResponse(500, { error: 'Webhook processing failed' });
  }

  return jsonResponse(200, { received: true });
};

// Netlify Functions 2.x Web-API adapter: same handler, Request in, legacy
// { statusCode, body } out. Whichever invocation style the runtime picks,
// behavior is identical.
export default async function stripeWebhook(request) {
  const headers = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return handler({
    httpMethod: request.method,
    headers,
    body: await request.text(),
    isBase64Encoded: false,
  });
}
