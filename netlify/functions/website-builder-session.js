// netlify/functions/website-builder-session.js
//
// Single sign-on for the embedded Smart Website Builder (apps/openthorn,
// served at /openthorn/). The builder talks to Supabase with Supabase Auth
// sessions (auth.uid() in its RLS policies), while SmartVideo signs people in
// with Clerk. This endpoint bridges the two:
//
//   1. withClerkAuth verifies the caller's Clerk session JWT.
//   2. Any signed-in SmartVideo user may use the builder; no paid plan is
//      required. (`claimsHaveFeature` is kept for callers that want to
//      tell paid from free accounts.)
//   3. The Clerk user's primary email must be verified. Supabase accounts in
//      this project are shared with other apps, so an unverified address
//      must never be linked to an existing auth user.
//   4. Finds or creates the Supabase auth user for that email, upserts the
//      builder profile (wb_profiles), and returns a one-time magic-link
//      token hash. The browser exchanges it with
//      supabase.auth.verifyOtp({ type: 'email', token_hash }). No email is
//      sent and the action link is never exposed.
//
// Environment (Netlify): CLERK_SECRET_KEY (+ the Clerk JWKS settings used by
// _shared/clerkAuth.js), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { withClerkAuth } from './_shared/clerkAuth.js';

export const PAID_FEATURE = 'smartvideo_full_access';
const CLERK_API = 'https://api.clerk.com/v1';

function json(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

/**
 * Clerk session tokens (v2) carry enabled Billing features in the `fea`
 * claim as a comma-separated list with scope prefixes, e.g. "u:pro,o:team".
 */
export function claimsHaveFeature(claims, feature = PAID_FEATURE) {
  const raw = claims?.fea;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  return list.some((entry) => String(entry).trim().replace(/^[a-z]+:/, '') === feature);
}

export function primaryVerifiedEmail(user) {
  const emails = Array.isArray(user?.email_addresses) ? user.email_addresses : [];
  const primary = emails.find((e) => e.id === user?.primary_email_address_id);
  if (!primary?.email_address || primary.verification?.status !== 'verified') return null;
  return primary.email_address.trim().toLowerCase();
}

async function fetchClerkUser(userId, fetchImpl) {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) throw new Error('CLERK_SECRET_KEY is not configured');
  const res = await fetchImpl(`${CLERK_API}/users/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) throw new Error(`Clerk user lookup failed (${res.status})`);
  return res.json();
}

function isAlreadyRegistered(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.code === 'email_exists' ||
    error?.code === 'user_already_exists' ||
    msg.includes('already been registered') ||
    msg.includes('already registered')
  );
}

/**
 * Proof, bound to one email address, that a Supabase login was created by this
 * server. hex(HMAC-SHA256(login_secret, lower(email))). The database trigger
 * public.handle_new_user recomputes it and, on a match, skips the main app's
 * public.users insert (which cannot succeed: its clerk_id column is NOT NULL
 * and the trigger never supplies it). Only the service role can read
 * login_secret, so nobody else can produce a valid proof.
 */
export function loginProof(secret, email) {
  return createHmac('sha256', secret).update(String(email).toLowerCase()).digest('hex');
}

async function readLoginSecret(admin) {
  const { data, error } = await admin
    .from('wb_private_config')
    .select('value')
    .eq('key', 'login_secret')
    .maybeSingle();
  if (error) throw error;
  if (!data?.value) throw new Error('wb_private_config.login_secret is not set');
  return data.value;
}

/**
 * Create the Supabase auth user for a first-time builder visitor.
 *
 * This must happen BEFORE generateLink: generateLink({ type: 'magiclink' })
 * silently creates unknown users itself, without the proof, which the main
 * app's on_auth_user_created trigger then rejects.
 *
 * The proof has to be in user_metadata: Supabase's admin API writes
 * app_metadata in a second step, after the auth.users row (and the trigger)
 * already ran, so a marker there is never seen. See
 * supabase/migrations/20261111120000_website_builder_login_proof.sql.
 * An address that already has a Supabase login (from another app) is reused.
 */
async function ensureAuthUser(admin, email, clerkUserId, profile = {}) {
  const secret = await readLoginSecret(admin);
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      wb_login_proof: loginProof(secret, email),
      clerk_user_id: clerkUserId,
      full_name: profile.fullName || undefined,
      avatar_url: profile.avatarUrl || undefined,
    },
    app_metadata: { clerk_user_id: clerkUserId, source: 'smart-website-builder' },
  });
  if (error && !isAlreadyRegistered(error)) throw error;
}

/** Generate a one-time magic-link token for an existing Supabase auth user. */
async function issueMagicLink(admin, email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const tokenHash = data?.properties?.hashed_token;
  const authUserId = data?.user?.id;
  if (!tokenHash || !authUserId) throw new Error('Magic link response was incomplete');
  return { tokenHash, authUserId };
}

export function createHandler({ fetchImpl = fetch, createAdminClient } = {}) {
  return async function websiteBuilderSession(event) {
    if (event.httpMethod && event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const { userId } = event.auth || {};
    if (!userId) return json(401, { error: 'not_signed_in' });

    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey || !process.env.CLERK_SECRET_KEY) {
      console.error('[website-builder-session] missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / CLERK_SECRET_KEY');
      return json(503, { error: 'not_configured' });
    }

    let clerkUser;
    try {
      clerkUser = await fetchClerkUser(userId, fetchImpl);
    } catch (err) {
      console.error('[website-builder-session]', err.message);
      return json(502, { error: 'clerk_unavailable' });
    }

    const email = primaryVerifiedEmail(clerkUser);
    if (!email) return json(403, { error: 'email_not_verified' });

    const admin = createAdminClient
      ? createAdminClient(url, serviceKey)
      : createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    try {
      // A returning builder user is matched by Clerk id, so a later change of
      // their SmartVideo email never splits their projects across two logins.
      const { data: existing, error: lookupError } = await admin
        .from('wb_profiles')
        .select('id, email')
        .eq('clerk_user_id', userId)
        .maybeSingle();
      if (lookupError) throw lookupError;

      const fullName = [clerkUser.first_name, clerkUser.last_name].filter(Boolean).join(' ') || clerkUser.username || null;
      const loginEmail = existing?.email || email;
      if (!existing) {
        await ensureAuthUser(admin, loginEmail, userId, { fullName, avatarUrl: clerkUser.image_url });
      }
      const { tokenHash, authUserId } = await issueMagicLink(admin, loginEmail);

      const { data: profile, error: profileError } = await admin
        .from('wb_profiles')
        .upsert(
          { id: authUserId, email: loginEmail, clerk_user_id: userId, full_name: fullName, avatar_url: clerkUser.image_url || null },
          { onConflict: 'id' },
        )
        .select('suspended')
        .single();
      if (profileError) throw profileError;
      if (profile?.suspended) return json(403, { error: 'suspended' });

      return json(200, { token_hash: tokenHash, type: 'email', email: loginEmail });
    } catch (err) {
      console.error('[website-builder-session] session issue failed:', err?.message || err);
      return json(500, { error: 'session_failed' });
    }
  };
}

export const handler = withClerkAuth(createHandler());
