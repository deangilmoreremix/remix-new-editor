/**
 * Compatibility API key helpers.
 *
 * CineGen ports expect these helpers with CineGen-specific localStorage
 * keys. In this codebase the canonical source is `apiKeyManager`, but
 * several ported node components still import these names. We keep the
 * same interface while delegating to `apiKeyManager` where possible.
 */

import { apiKeyManager } from '../apiKeyManager.js';

export function getApiKey() {
  // CineGen uses 'falKey'; our apiKeyManager uses the muapi key for media generation.
  return apiKeyManager.getMuapiKey?.() ?? apiKeyManager.getKey?.('fal') ?? undefined;
}

export function getKieApiKey() {
  return apiKeyManager.getKey?.('kie') ?? undefined;
}

export function getRunpodApiKey() {
  return apiKeyManager.getKey?.('runpod') ?? undefined;
}

export function getPodUrl() {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('cinegen_settings');
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    const value = parsed?.podUrl;
    return typeof value === 'string' && value.trim() ? value : undefined;
  } catch {
    return undefined;
  }
}

export function getRunpodEndpointId(nodeType) {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem('cinegen_settings');
    if (!raw) return undefined;
    const endpoints = JSON.parse(raw)?.runpodEndpoints;
    return endpoints?.[nodeType] ?? undefined;
  } catch {
    return undefined;
  }
}
