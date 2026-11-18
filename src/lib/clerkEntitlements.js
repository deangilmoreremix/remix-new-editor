import { useAuth, useUser } from '@clerk/react';

export const PAID_FEATURE = 'smartvideo_full_access';

export function useEntitlement() {
  const { has, isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  if (!isLoaded) return { loading: true, hasFullAccess: false, isSignedIn: false };
  if (!isSignedIn) return { loading: false, hasFullAccess: false, isSignedIn: false };

  const hasBillingAccess = has?.({ feature: PAID_FEATURE }) ?? false;
  const hasLegacyAccess = user?.publicMetadata?.legacy_access === true;
  const hasFullAccess = hasBillingAccess || hasLegacyAccess;
  return { loading: false, hasFullAccess, isSignedIn: true };
}

const ENTITLEMENT_CACHE_KEY = '__smartvideo_entitlement__';

function getCache() {
  try {
    return globalThis[ENTITLEMENT_CACHE_KEY] || { hasFullAccess: false };
  } catch {
    return { hasFullAccess: false };
  }
}

export function getEntitlement() {
  return getCache();
}

export function setEntitlement(value) {
  try {
    globalThis[ENTITLEMENT_CACHE_KEY] = value;
  } catch {
    // ignore
  }
}

export function hasFullAccess() {
  return getCache().hasFullAccess === true;
}

/**
 * Full access right now, read from Clerk itself (window.Clerk): the billing feature, or legacy access on the user.
 * The same rule as useEntitlement. The cached value (a plain global anyone can set from the console) is only used
 * on a Clerk too old to answer checkAuthorization; a check that throws counts as no access.
 */
export function hasPaidAccess(clerk = globalThis.window?.Clerk) {
  if (!clerk?.user) return false;
  if (clerk.user.publicMetadata?.legacy_access === true) return true;
  if (typeof clerk.session?.checkAuthorization !== 'function') return hasFullAccess();
  try { return clerk.session.checkAuthorization({ feature: PAID_FEATURE }) === true; } catch { return false; }
}

export async function requireEntitlement() {
  // Once Clerk is loaded it decides; the cache only covers the moment before it loads.
  const clerk = globalThis.window?.Clerk;
  if (clerk?.loaded || clerk?.user ? hasPaidAccess(clerk) : hasFullAccess()) return true;
  const { default: UpgradePrompt } = await import('../components/UpgradePrompt.js');
  UpgradePrompt();
  return false;
}
