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

// Module-private entitlement state. The entitlement object is intentionally
// NOT exposed on globalThis/window: anything writable there can be tampered
// with from the console (or e2e globals) to unlock every paid gate.
// setEntitlement() is the ONLY writer.
let entitlementState = { hasFullAccess: false };

const ENTITLEMENT_OVERRIDE_KEY = '__smartvideo_entitlement_override';

export function getEntitlement() {
  return { ...entitlementState };
}

export function setEntitlement(value) {
  entitlementState = { hasFullAccess: value?.hasFullAccess === true };
}

// Explicit test/e2e override: a function (not a writable data slot) that
// writes through the private setter. Defined non-writable/non-configurable so
// neither reassigning this property nor assigning the old global
// (window.__smartvideo_entitlement__) has any effect on the gate.
function defineEntitlementOverride() {
  if (typeof window === 'undefined') return;
  try {
    Object.defineProperty(window, ENTITLEMENT_OVERRIDE_KEY, {
      value: (value) => { setEntitlement(value); return hasFullAccess(); },
      writable: false,
      configurable: false,
      enumerable: false,
    });
  } catch {
    // ignore
  }
}
defineEntitlementOverride();

export function hasFullAccess() {
  return entitlementState.hasFullAccess === true;
}

export async function requireEntitlement() {
  if (hasFullAccess()) return true;
  const { default: UpgradePrompt } = await import('../components/UpgradePrompt.js');
  UpgradePrompt();
  return false;
}
