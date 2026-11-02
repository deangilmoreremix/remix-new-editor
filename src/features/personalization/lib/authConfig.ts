/**
 * remix-new-editor shim for OpenHiggsBolt's `@/lib/authConfig`.
 *
 * remix keeps every provider key in `src/lib/apiKeyManager.js` (Settings
 * modal). This module exposes the same surface the ported personalization
 * code expects, but reads and writes through that manager so there is one
 * source of truth for keys across the app.
 */
import React from 'react'
import { apiKeyManager } from '../../../lib/apiKeyManager.js'

type Listener = () => void
const listeners = new Set<Listener>()
function notify() { listeners.forEach((l) => { try { l() } catch { /* ignore */ } }) }

if (typeof window !== 'undefined') {
  // Same-tab changes (Settings modal → apiKeyManager.setMuapiKey / clear…)
  // arrive through apiKeyManager's own listener API, matching OpenHiggsBolt's
  // authConfig, which notified its listeners on every set/clear. Storage
  // events cover other tabs.
  apiKeyManager.addListener?.(notify)
  window.addEventListener('storage', notify)
}

export function __resetAuthConfigForTests(): void { notify() }
export function getApiKey(): string { return apiKeyManager.getMuapiKey() || '' }
export function getOpenAiKey(): string { return apiKeyManager.getOpenAIKey() || '' }
export function setApiKey(key: string | null | undefined): void {
  if (key) apiKeyManager.setMuapiKey(String(key).trim()); else apiKeyManager.clearMuapiKey()
  notify()
}
export function setOpenAiKey(key: string | null | undefined): void {
  if (key) apiKeyManager.setOpenAIKey(String(key).trim()); else apiKeyManager.clearOpenAIKey()
  notify()
}
export function clearApiKey(): void { apiKeyManager.clearMuapiKey(); notify() }
export function clearOpenAiKey(): void { apiKeyManager.clearOpenAIKey(); notify() }
export function clearAllKeys(): void { clearApiKey(); clearOpenAiKey() }

export function useAuthConfig() {
  const [, force] = React.useState(0)
  React.useEffect(() => {
    const l = () => force((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  const apiKey = getApiKey()
  const openaiKey = getOpenAiKey()
  return {
    apiKey,
    openaiKey,
    setApiKey,
    setOpenAiKey,
    clearApiKey,
    clearOpenAiKey,
    clearAllKeys,
    hasApiKey: Boolean(apiKey),
    hasOpenAiKey: Boolean(openaiKey),
    isAuthenticated: Boolean(apiKey),
  }
}
