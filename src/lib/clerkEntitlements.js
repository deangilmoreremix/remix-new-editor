import { useAuth } from '@clerk/react';

export const PAID_FEATURE = 'smartvideo_full_access';

export function useEntitlement() {
  const { has, isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return { loading: true, hasFullAccess: false, isSignedIn: false };
  if (!isSignedIn) return { loading: false, hasFullAccess: false, isSignedIn: true };

  const hasFullAccess = has?.({ feature: PAID_FEATURE }) ?? false;
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

export async function requireEntitlement() {
  if (hasFullAccess()) return true;
  const { default: UpgradePrompt } = await import('../components/UpgradePrompt.js');
  UpgradePrompt();
  return false;
}
