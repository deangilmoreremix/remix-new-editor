/**
 * remix-new-editor shim for OpenHiggsBolt's SmartVideo access context.
 *
 * remix has no SmartVideo entitlement layer: no provider is mounted, so the
 * context stays null and `studioEntry` falls back to its permissive
 * `ALLOW_ENTITLEMENT` path. Sign-in is still enforced by the API routes.
 */
import { createContext, useContext } from 'react'
import { ENTITLEMENTS } from './entitlements'

export { ENTITLEMENTS }

export interface SmartVideoAccessContextValue {
  requireEntitlement: <T>(
    entitlement: string,
    onAllowed: () => T | Promise<T>,
    onDenied?: () => void,
  ) => Promise<T | undefined>
}

const SmartVideoAccessContext = createContext<SmartVideoAccessContextValue | null>(null)
export { SmartVideoAccessContext }

const PERMISSIVE: SmartVideoAccessContextValue = {
  // No paid-plan gate in remix: OpenHiggsBolt's own fallback (no provider)
  // runs the action. Sign-in is enforced by the API routes.
  requireEntitlement: async (_entitlement, onAllowed) => onAllowed(),
}

/** OpenHiggsBolt's hook; without a provider it returns the permissive default, as upstream does. */
export function useSmartVideoAccess(): SmartVideoAccessContextValue {
  return useContext(SmartVideoAccessContext) ?? PERMISSIVE
}
