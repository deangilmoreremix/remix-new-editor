// Client auth context for MuAPI upload flows.
//
// Resolves, in one call, everything the upload path needs to know about the
// current caller:
//
//   { userId, workspaceId, muapiKey, hasMuapiKey, isAnonymous }
//
//   - userId: Clerk user id when signed in, else the shared local identity
//     ('anonymous' for the app's legacy local usage). Resolved through
//     src/lib/userKey.js — the SAME helper supabase.js and
//     hybrid-supabase.js use for their request identity — so every writer
//     path (authContext, assetLibrary, hybrid sync, token exchange) agrees
//     on one owner id. A signed-in caller therefore always resolves to the
//     Clerk user id and never to a hashed 'user_xxx' fallback.
//   - workspaceId: the user's authorized workspace (active Clerk organization
//     id when available, else 'personal').
//   - muapiKey: the caller's own MuAPI key, resolved client-side via
//     apiKeyManager (BYOK). The key is NEVER logged, never persisted to the
//     server, and never shared between users.
//
// The Clerk session is read from `window.Clerk`, the singleton set up by
// src/lib/clerkInit.js (and by <ClerkProvider>) once Clerk has loaded. This
// is the same read pattern used by videoAgentAuth.js and brandStore.js, so
// this module does not need to import the Clerk SDK itself.

import { apiKeyManager } from './apiKeyManager.js';
import { getUserKey as getSharedUserKey } from './userKey.js';

// Error codes. These mirror the MuAPI upload error contract; they are
// declared locally (not imported) to keep this module dependency-free and
// avoid an import cycle with the upload implementation.
export const ERROR_CODES = {
  MUAPI_KEY_MISSING: 'MUAPI_KEY_MISSING',
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
};

const DEFAULT_WORKSPACE_ID = 'personal';

/**
 * Returns the live Clerk instance, or null when Clerk is unavailable
 * (anonymous local usage). Never throws.
 */
function getClerkClient() {
  try {
    if (typeof window === 'undefined' || !window.Clerk) return null;
    return window.Clerk;
  } catch {
    return null;
  }
}

/**
 * Best-effort read of the signed-in Clerk user. Returns null when Clerk
 * has not loaded or nobody is signed in.
 */
function getClerkUser(clerk) {
  try {
    const user = clerk?.user;
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the authorized workspace for the current Clerk user.
 * Prefers the active organization, then the first organization membership,
 * then falls back to the personal workspace.
 */
function resolveWorkspaceId(clerk, user) {
  try {
    const activeOrg = clerk?.organization;
    if (activeOrg?.id) return activeOrg.id;
    const memberships = user?.organizationMemberships;
    if (Array.isArray(memberships)) {
      const firstOrg = memberships.find((m) => m?.organization?.id);
      if (firstOrg) return firstOrg.organization.id;
    }
  } catch {
    // Fall through to the personal workspace.
  }
  return DEFAULT_WORKSPACE_ID;
}

// Synchronous identity read shared by getAuthContext() / getAuthContextSync().
// The Clerk id wins when signed in; otherwise the shared local identity
// keeps this context and the Supabase clients on the same owner id.
function resolveIdentity() {
  const clerk = getClerkClient();
  const user = getClerkUser(clerk);
  const isAnonymous = !user;
  return {
    userId: user ? user.id : getSharedUserKey(),
    workspaceId: isAnonymous ? DEFAULT_WORKSPACE_ID : resolveWorkspaceId(clerk, user),
    isAnonymous,
  };
}

/**
 * Build the full auth context (async hot-entry variant).
 * Resolves the BYOK MuAPI key via apiKeyManager — the value is returned to
 * the caller only and is never written anywhere by this module.
 */
export async function getAuthContext() {
  const identity = resolveIdentity();
  const muapiKey = apiKeyManager.getMuapiKey();
  return {
    ...identity,
    muapiKey: muapiKey || null,
    hasMuapiKey: !!muapiKey,
  };
}

/**
 * Synchronous variant for hot paths where the Clerk session is already
 * known to be loaded (window.Clerk present). Same shape as getAuthContext().
 */
export function getAuthContextSync() {
  const identity = resolveIdentity();
  const muapiKey = apiKeyManager.getMuapiKey();
  return {
    ...identity,
    muapiKey: muapiKey || null,
    hasMuapiKey: !!muapiKey,
  };
}

/**
 * Guard for MuAPI-bound actions. Throws with code 'MUAPI_KEY_MISSING' when
 * the caller has not provided their own MuAPI key (BYOK — no key, no
 * MuAPI upload). Whitespace-only keys count as missing.
 */
export function requireMuapiKey(authContext) {
  const key = authContext && typeof authContext.muapiKey === 'string'
    ? authContext.muapiKey.trim()
    : '';
  if (!key) {
    const err = new Error(
      'MuAPI key missing. Add your own MuAPI key in Settings to use this feature.',
    );
    err.code = ERROR_CODES.MUAPI_KEY_MISSING;
    throw err;
  }
  return authContext;
}

/**
 * Workspace guard. Throws when `resource` belongs to another user
 * (cross-USER access) or to a different workspace than the caller's
 * authorized one (cross-WORKSPACE access). Resources owned by the caller —
 * and anonymous resources accessed by the anonymous local user — pass.
 *
 * @param {{userId?: string, workspaceId?: string}} resource
 */
export function assertWorkspaceAccess(authContext, resource) {
  if (!authContext) {
    const err = new Error('Auth context required for workspace access check');
    err.code = ERROR_CODES.WORKSPACE_ACCESS_DENIED;
    throw err;
  }
  if (!resource || typeof resource !== 'object') {
    const err = new Error('Resource required for workspace access check');
    err.code = ERROR_CODES.WORKSPACE_ACCESS_DENIED;
    throw err;
  }

  const ownerId = resource.userId || resource.ownerId || resource.user_id || null;
  const resourceWorkspace = resource.workspaceId || resource.workspace_id || null;

  const isForeignOwner = ownerId != null && ownerId !== authContext.userId;
  const isForeignWorkspace = resourceWorkspace != null
    && authContext.workspaceId != null
    && resourceWorkspace !== authContext.workspaceId;

  if (isForeignOwner || isForeignWorkspace) {
    const err = new Error('Access denied: resource belongs to another user or workspace');
    err.code = ERROR_CODES.WORKSPACE_ACCESS_DENIED;
    throw err;
  }
  return true;
}
