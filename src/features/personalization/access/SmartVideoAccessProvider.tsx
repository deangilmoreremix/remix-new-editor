/**
 * remix-new-editor shim for OpenHiggsBolt's SmartVideo access context.
 *
 * remix has no SmartVideo entitlement layer: no provider is mounted, so the
 * context stays null and `studioEntry` falls back to its permissive
 * `ALLOW_ENTITLEMENT` path. Sign-in is still enforced by the API routes.
 */
import { createContext } from 'react'
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
