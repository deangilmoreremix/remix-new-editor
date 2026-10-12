/**
 * personalizationAuth.js
 *
 * Client-side identity seam for the personalization system.
 *
 * remix-new-editor identifies users with Clerk (@clerk/clerk-js) and talks
 * to Supabase with the anon key — it does NOT use Supabase Auth, so
 * `auth.uid()` is always NULL and the database cannot verify who the
 * caller is. Personalization data is therefore scoped APP-SIDE with the
 * repo's existing app-level user key, and the RLS policies in
 * supabase/migrations/20261013000000_fix_personalization_outputs_rls.sql
 * provide defence in depth on the same value.
 *
 * The contract (mirrors the SQL migration header — keep the two in sync):
 *
 *   WRITE: every persisted personalization row is stamped with
 *          `clerk_user_id = getPersonalizationUserId()` by
 *          withPersonalizationOwner(). A caller-supplied owner is NEVER
 *          trusted — it is always overwritten.
 *   READ:  every read filters through canAccess(), so a row belongs to the
 *          current user only when its `clerk_user_id` equals the current
 *          user id. Rows with a null/undefined owner are legacy rows from
 *          before stamping existed and are treated as belonging to this
 *          device's user (see canAccess for the documented trade-off).
 *
 * Identity resolution order (delegated to getUserKey() — do NOT re-read
 * Clerk here; the Clerk sign-in flow already persists the Clerk user id
 * into the offlineStorage slot that getUserKey() prefers):
 *   1. offlineStorage.getCurrentUserId() — the Clerk userId slot
 *      (localStorage['offline_user_id']).
 *   2. A stable hash of the MuAPI key ('user_<hash>').
 *   3. 'anonymous'.
 */

import { getUserKey } from './userKey.js';

/** Canonical owner field on personalization rows (matches the SQL column). */
export const PERSONALIZATION_OWNER_FIELD = 'clerk_user_id';

/** GUC the RLS policies read; set via the `set_app_clerk_user_id` RPC. */
export const PERSONALIZATION_OWNER_SETTING = 'app.clerk_user_id';

/**
 * Authoritative current user id for personalization scoping.
 * Always a non-empty string: the Clerk userId when signed in, a stable
 * fallback otherwise, and 'anonymous' as the last resort.
 *
 * @returns {string}
 */
export function getPersonalizationUserId() {
  try {
    const id = getUserKey();
    return typeof id === 'string' && id.length > 0 ? id : 'anonymous';
  } catch {
    return 'anonymous';
  }
}

/**
 * True when a usable identity is available for personalization scoping.
 * Always true in practice (getPersonalizationUserId never returns empty);
 * kept as an explicit readiness check for stores that want to fail loudly.
 *
 * @returns {boolean}
 */
export function isPersonalizationAuthReady() {
  return getPersonalizationUserId().length > 0;
}

/**
 * True when the current identity is a signed-in user, i.e. not the shared
 * 'anonymous' fallback.
 *
 * @returns {boolean}
 */
export function isPersonalizationSignedIn() {
  return getPersonalizationUserId() !== 'anonymous';
}

/**
 * Stamp an entry with the current owner. The authoritative id ALWAYS
 * overwrites any caller-supplied owner (a caller must never be able to
 * forge ownership of a row it creates on someone else's behalf).
 *
 * @param {Record<string, unknown>} entry
 * @returns {Record<string, unknown>} a shallow copy with the owner fields set
 */
export function withPersonalizationOwner(entry) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const uid = getPersonalizationUserId();
  return {
    ...source,
    [PERSONALIZATION_OWNER_FIELD]: uid,
    clerkUserId: uid,
  };
}

/**
 * Read the owner off an entry. Accepts the canonical `clerk_user_id` field
 * and the legacy `clerkUserId` alias.
 *
 * @param {Record<string, unknown> | null | undefined} entry
 * @returns {string | null | undefined}
 */
export function getPersonalizationOwner(entry) {
  if (!entry || typeof entry !== 'object') return undefined;
  if (entry[PERSONALIZATION_OWNER_FIELD] !== undefined) return entry[PERSONALIZATION_OWNER_FIELD];
  if (entry.clerkUserId !== undefined) return entry.clerkUserId;
  return undefined;
}

/**
 * Can the current user access this entry?
 *
 *  - owner === current user id      -> true (match)
 *  - owner === any other id         -> false (never cross users; an
 *                                     anonymous/fallback session can never
 *                                     read a signed-in user's rows, nor
 *                                     the reverse)
 *  - owner is null or undefined     -> true (legacy rows written before
 *                                     stamping existed are treated as this
 *                                     device's user; the SQL policies still
 *                                     reject NULL owners, so the database
 *                                     side fails closed)
 *  - owner is '' or a non-string    -> false (malformed, fail closed)
 *
 * @param {Record<string, unknown> | null | undefined} entry
 * @returns {boolean}
 */
export function canAccess(entry) {
  const owner = getPersonalizationOwner(entry);
  if (owner === null || owner === undefined) return true;
  if (typeof owner !== 'string' || owner.length === 0) return false;
  return owner === getPersonalizationUserId();
}

/**
 * Assert access to a single entry. Used on mutation paths (UPDATE/DELETE)
 * to reject cross-user attempts. Throws when denied.
 *
 * @param {Record<string, unknown>} entry
 * @param {string} [operation] label for the error message
 * @returns {true}
 */
export function assertOwner(entry, operation = 'access') {
  if (!canAccess(entry)) {
    const owner = getPersonalizationOwner(entry);
    throw new Error(
      `personalizationAuth: ${operation} denied — row owned by ${JSON.stringify(owner)}, current user is ${JSON.stringify(getPersonalizationUserId())}`,
    );
  }
  return true;
}

/**
 * Filter a list of entries down to the ones the current user may access.
 *
 * @param {Array<Record<string, unknown>> | null | undefined} entries
 * @returns {Array<Record<string, unknown>>}
 */
export function filterPersonalizationEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry) => canAccess(entry));
}

/**
 * Namespace a localStorage key by the current user id so per-user data
 * never shares a bucket.
 *
 * @param {string} baseKey
 * @returns {string}
 */
export function getPersonalizationStorageKey(baseKey) {
  return `${baseKey}:${getPersonalizationUserId()}`;
}

/**
 * Announce the current owner to Supabase so the RLS policies can match it:
 * calls the `set_app_clerk_user_id` RPC defined in
 * 20261013000000_fix_personalization_outputs_rls.sql. Best-effort — the
 * clients also filter explicitly with .eq('clerk_user_id', uid), so a lost
 * GUC (connection pooling) fails closed instead of leaking.
 *
 * @param {{ rpc?: Function } | null | undefined} supabaseClient
 * @returns {Promise<boolean>} whether the handshake was sent
 */
export async function announcePersonalizationOwner(supabaseClient) {
  if (!supabaseClient || typeof supabaseClient.rpc !== 'function') return false;
  const uid = getPersonalizationUserId();
  if (!uid) return false;
  try {
    await supabaseClient.rpc('set_app_clerk_user_id', { p_user_id: uid });
    return true;
  } catch {
    // Best effort only; the explicit .eq() filter remains authoritative.
    return false;
  }
}

export default {
  PERSONALIZATION_OWNER_FIELD,
  PERSONALIZATION_OWNER_SETTING,
  getPersonalizationUserId,
  isPersonalizationAuthReady,
  isPersonalizationSignedIn,
  withPersonalizationOwner,
  getPersonalizationOwner,
  canAccess,
  assertOwner,
  filterPersonalizationEntries,
  getPersonalizationStorageKey,
  announcePersonalizationOwner,
};
