// netlify/functions/_shared/workspaceGuard.js
//
// Server-side twin of src/lib/authContext.js workspace isolation, for
// Netlify functions that read or write user-owned rows (media, MuAPI upload
// cache, assets). Designed to work with the app's anon-key Supabase client,
// where the caller identity arrives as the `x-user-key` request header
// (the idiom used by the core tables' RLS policies) — or, on functions
// protected by withClerkAuth, as `event.auth` from the Clerk session.
//
// Exports:
//   assertWorkspaceAccess(authContext, resource)
//     -> { ok: true } | { ok: false, statusCode: 403, ...error payload }
//   queryScoped(query, authContext, options)
//     -> the same Supabase query builder, with user/workspace .eq() filters
//        applied so a caller can only ever see their own rows.

export const ERROR_CODES = {
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
};

/**
 * Authorization check for a resource the caller wants to touch.
 *
 * `resource` may carry the owner as `userId`, `ownerId` or `user_id`, and
 * the workspace as `workspaceId` or `workspace_id`. A missing owner field
 * means "unowned resource" and passes; a present owner or workspace that
 * does not match the caller's context is denied with a 403 payload.
 *
 * @returns {{ok: true}|{ok: false, statusCode: number, headers: object, body: string}}
 */
export function assertWorkspaceAccess(authContext, resource) {
  if (!authContext || typeof authContext !== 'object') {
    return deniedResponse('Auth context required for workspace access check');
  }
  if (!resource || typeof resource !== 'object') {
    return deniedResponse('Resource required for workspace access check');
  }

  const ownerId = resource.userId ?? resource.ownerId ?? resource.user_id ?? null;
  const resourceWorkspace = resource.workspaceId ?? resource.workspace_id ?? null;

  const isForeignOwner = ownerId != null && ownerId !== authContext.userId;
  const isForeignWorkspace = resourceWorkspace != null
    && authContext.workspaceId != null
    && resourceWorkspace !== authContext.workspaceId;

  if (isForeignOwner || isForeignWorkspace) {
    return deniedResponse('Access denied: resource belongs to another user or workspace');
  }

  return { ok: true };
}

/**
 * Build the 403 payload returned by assertWorkspaceAccess on mismatch.
 * Uses the same JSON shape as the other Netlify functions' error responses.
 */
function deniedResponse(message) {
  return {
    ok: false,
    statusCode: 403,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: message,
      code: ERROR_CODES.WORKSPACE_ACCESS_DENIED,
    }),
  };
}

/**
 * Scope a Supabase query builder to the caller's user (and workspace, when
 * the table carries one). Every function that selects or mutates rows must
 * run its queries through this helper so the DB query itself carries the
 * ownership constraint instead of trusting client-provided ids.
 *
 * @param {object} query   a PostgrestFilterBuilder (has `.eq()`)
 * @param {{userId: string, workspaceId?: string}} authContext
 * @param {{table?: string, userIdColumn?: string, workspaceColumn?: string|null}} options
 * @returns {object} the query with the scope filters applied
 */
export function queryScoped(query, authContext, options = {}) {
  if (!query || typeof query.eq !== 'function') {
    throw new Error('queryScoped requires a Supabase query builder');
  }
  const {
    table,
    userIdColumn = 'user_id',
    workspaceColumn = null,
  } = options;
  if (!authContext || !authContext.userId) {
    throw new Error(`queryScoped requires an authenticated auth context${table ? ` (table: ${table})` : ''}`);
  }

  let scoped = query.eq(userIdColumn, authContext.userId);
  if (workspaceColumn && authContext.workspaceId) {
    scoped = scoped.eq(workspaceColumn, authContext.workspaceId);
  }
  return scoped;
}
