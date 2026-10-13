/**
 * personalizationAuth.js
 *
 * The personalization identity seam: WHO the current user is, and which
 * rows/entries that identity owns.
 *
 * ── AUTHORITATIVE IDENTITY ─────────────────────────────────────────────────
 * The ONLY authoritative identity is the VERIFIED CLERK SESSION, read
 * synchronously from the Clerk instance via getClerkInstance()
 * (src/lib/clerkInit.js): `clerk.user.id` / `clerk.session.user.id`. Clerk
 * only populates those after it has verified the session itself, so the id
 * this module returns has been cryptographically checked by Clerk — it is
 * never a client-supplied value, never a MuAPI-key hash, and never the old
 * shared 'anonymous' fallback.
 *
 * ── WHERE OWNERSHIP IS ENFORCED ────────────────────────────────────────────
 * Supabase. The browser client (src/lib/supabase.js) sends the Clerk
 * session JWT on every request (supabase-js `accessToken` option), Supabase
 * verifies it against the Clerk JWKS, and the RLS policies in
 * supabase/migrations/20261013120000_harden_personalization_rls.sql gate
 * every row on `clerk_user_id = (select auth.jwt() ->> 'sub')`. A forged id
 * can no longer satisfy that predicate, because the database no longer
 * trusts anything the client announces: the old `set_app_clerk_user_id()`
 * RPC and the `current_clerk_user_id()` GUC helper are DROPPED, and with
 * them the only client-controllable identity path.
 *
 * This module is the CLIENT-SIDE HALF of that contract: it stamps the
 * verified id on writes and filters/hecks it on reads so the app never
 * sends rows the database would reject. It is defence in depth, NOT the
 * enforcement boundary — the database is. If the Clerk->Supabase
 * third-party provider is not configured yet, `auth.jwt() ->> 'sub'` is
 * NULL and every policy matches zero rows: FAIL CLOSED.
 *
 * ── SIGNED-OUT BEHAVIOUR (fail closed) ─────────────────────────────────────
 * getPersonalizationUserId() returns null when there is no verified Clerk
 * session. Every helper degrades safely instead of inventing an identity:
 *   - withPersonalizationOwner() stamps NO owner (null) — it can never stamp
 *     a caller-supplied, foreign, or shared-bucket id;
 *   - getPersonalizationStorageKey() switches to a dedicated device-local
 *     `signed-out` namespace — unowned rows are never written into another
 *     user's bucket;
 *   - callers that must persist (e.g. Supabase writes) should go through
 *     assertVerifiedIdentity(), which throws instead of guessing an id;
 *   - the database itself rejects unowned rows, because no JWT can present
 *     a `sub` claim equal to NULL.
 */

import { getClerkInstance } from './clerkInit.js';

/** The owner column stamped on every personalization row. */
export const PERSONALIZATION_OWNER_FIELD = 'clerk_user_id';
/** Legacy alias kept for entries written with the camelCase shape. */
const OWNER_ALIAS = 'clerkUserId';

/** Device-local namespace for signed-out (unowned) localStorage buckets. */
const SIGNED_OUT_NAMESPACE = 'signed-out';

/**
 * Read the Clerk instance without ever throwing and without importing
 * @clerk/clerk-js here directly (clerkInit.js owns loading). Falls back to
 * the window handle because ensureClerkLoaded()/ClerkProvider publish it
 * there before module-scoped helper calls happen.
 *
 * @returns {any | null}
 */
function getClerkSafely() {
  try {
    const clerk = getClerkInstance();
    if (clerk) return clerk;
    if (typeof window !== 'undefined' && window.Clerk) return window.Clerk;
    return null;
  } catch {
    return null;
  }
}

/**
 * The verified Clerk user id, or null when Clerk is not loaded / the user is
 * signed out. Synchronous on purpose: the store layer (sharedMediaStore,
 * assetLibraryStore, personalizeAiAssist) calls this at write time without
 * awaiting.
 *
 * @returns {string | null} the Clerk user id (e.g. `user_2b...`), or null
 */
export function getPersonalizationUserId() {
  const clerk = getClerkSafely();
  if (!clerk) return null;
  try {
    const id = clerk.user?.id ?? clerk.session?.user?.id ?? null;
    return typeof id === 'string' && id.trim().length > 0 ? id : null;
  } catch {
    return null;
  }
}

/** Is a verified identity available? (No 'anonymous' fallback exists.) */
export function isPersonalizationAuthReady() {
    return getPersonalizationUserId() !== null;
}

/** Is the current user signed in to Clerk with a verified session? */
export function isPersonalizationSignedIn() {
    return getPersonalizationUserId() !== null;
}

/**
 * Stamp a row/entry with the VERIFIED owner. The caller-supplied value —
 * however it arrives — is always overwritten:
 *   - signed in  → the verified Clerk user id (and nothing else);
 *   - signed out → null, i.e. explicitly unowned.
 * Never throws, so existing write paths (which do not guard) stay
 * functional; unowned rows simply fail closed at the database.
 *
 * @param {Record<string, unknown>} entry
 * @returns {Record<string, unknown>} a copy stamped with the verified owner
 */
export function withPersonalizationOwner(entry) {
    const verifiedId = getPersonalizationUserId();
    const stamped = { ...(entry || {}) };
    stamped[PERSONALIZATION_OWNER_FIELD] = verifiedId;
    stamped[OWNER_ALIAS] = verifiedId;
    return stamped;
}

/**
 * Read an entry's declared owner.
 *
 * @param {Record<string, unknown>} entry
 * @returns {unknown}
 */
export function getPersonalizationOwner(entry) {
    if (!entry) return null;
    if (PERSONALIZATION_OWNER_FIELD in entry) return entry[PERSONALIZATION_OWNER_FIELD];
    return entry[OWNER_ALIAS] ?? null;
}

/** Case- and whitespace-insensitive identity comparison. */
function normalizeIdentity(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/**
 * May the current VERIFIED identity read/write this row?
 * A row with no owner (null/undefined) is a legacy or device-local
 * unowned row: the database can never serve such a row to anyone (no
 * verified `sub` equals NULL), so this stays permissive only for the
 * device-local localStorage layer. A row that DECLARES an owner is only
 * accessible to that exact verified identity.
 *
 * @param {Record<string, unknown>} entry
 * @returns {boolean}
 */
export function canAccess(entry) {
    if (!entry) return false;
    const owner = getPersonalizationOwner(entry);
    if (owner === null || owner === undefined) return true;
    if (typeof owner !== 'string' || owner.trim().length === 0) return false;
    const current = getPersonalizationUserId();
    if (!current) return false;
    return normalizeIdentity(owner) === normalizeIdentity(current);
}

/**
 * Guard a mutation: throws unless canAccess(entry).
 *
 * @param {Record<string, unknown>} entry
 * @param {string} [operation]
 * @returns {true}
 */
export function assertOwner(entry, operation = 'access') {
    if (!canAccess(entry)) {
        throw new Error(
            `Personalization access denied (${operation}): row is not owned by the verified Clerk session`,
        );
    }
    return true;
}

/**
 * Keep only the rows the verified identity may see.
 *
 * @param {Array<Record<string, unknown>>} entries
 * @returns {Array<Record<string, unknown>>}
 */
export function filterPersonalizationEntries(entries) {
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry) => canAccess(entry));
}

/**
 * Namespaced localStorage key. Signed-in users get their own bucket; a
 * signed-out session gets a dedicated device-local `signed-out` bucket —
 * never a shared bucket that other sessions (or other users on this
 * device) could write into, and never a bucket that is synced with an
 * owner.
 *
 * @param {string} baseKey
 * @returns {string}
 */
export function getPersonalizationStorageKey(baseKey) {
    const uid = getPersonalizationUserId();
    return `${baseKey}:${uid ?? SIGNED_OUT_NAMESPACE}`;
}

/**
 * A fresh Clerk session token for callers that must pass an identity token
 * explicitly (e.g. server functions). Defaults to the plain Clerk session
 * token, which is exactly what Supabase's current Clerk third-party-auth
 * integration verifies (see the migration header for the doc citations).
 *
 * `template` opts into Clerk's legacy JWT-template minting (the deprecated
 * pre-2025-04-01 Supabase integration used a template named 'supabase').
 * It is requested only when a caller explicitly asks for it; the default
 * path never uses templates.
 *
 * @param {{ template?: string }} [options]
 * @returns {Promise<string | null>} the token, or null when unavailable
 */
export async function getPersonalizationAccessToken(options = {}) {
    const clerk = getClerkSafely();
    if (!clerk) return null;
    const session = clerk.session;
    if (!session || typeof session.getToken !== 'function') return null;
    try {
        const template = options && typeof options.template === 'string' && options.template.trim()
            ? options.template.trim()
            : null;
        const token = template
            ? await session.getToken({ template })
            : await session.getToken();
        return typeof token === 'string' && token.length > 0 ? token : null;
    } catch {
        return null;
    }
}

/**
 * Resolve the FULL verified identity for a write that must not be forged:
 * the verified Clerk user id plus a fresh Clerk token for the `supabase`
 * template, or throw. Use this before any operation that persists an
 * owner — it is the module's "no identity, no write" gate, complementing
 * the database's own rejection of unowned rows.
 *
 * @returns {Promise<{ userId: string, token: string, verified: true }>}
 * @throws {Error} when there is no verified Clerk session or no token
 */
export async function assertVerifiedIdentity() {
    const userId = getPersonalizationUserId();
    if (!userId) {
        throw new Error(
            'personalizationAuth: no verified Clerk session — refusing to act on an unverified identity',
        );
    }
    const token = await getPersonalizationAccessToken();
    if (!token) {
        throw new Error(
            'personalizationAuth: could not mint a Clerk token for the verified session — refusing to act',
        );
    }
    return { userId, token, verified: true };
}
