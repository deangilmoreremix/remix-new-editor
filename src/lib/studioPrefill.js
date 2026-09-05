// studioPrefill.js
// Shared mechanism for "Create This Style" / recipe deep-links to pre-fill a
// target studio before it mounts.
//
// A landing section / card calls stageStudioPrefill({ prompt, model, params })
// then navigates. The studio reads the staged payload on mount via
// consumeStudioPrefill(route) and applies it to its own controls.
//
// This is intentionally transport-agnostic: hash routers, localStorage and the
// window event all work, so a card can be opened from the landing page, the
// academy, or a deep link.

const KEY = 'sv_studio_prefill';

/**
 * Stage a payload that a studio should pick up on its next mount.
 * @param {{route:string, prompt?:string, model?:string, params?:object, ref?:string}} payload
 */
export function stageStudioPrefill(payload) {
  const clean = {
    route: payload.route,
    prompt: payload.prompt != null ? String(payload.prompt) : undefined,
    model: payload.model || undefined,
    params: payload.params || {},
    ref: payload.ref || 'minimax-h3',
    at: Date.now(),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable — fall back to in-memory + event only */
  }
  if (typeof window !== 'undefined') {
    window.__svStudioPrefill = clean;
    window.dispatchEvent(new CustomEvent('sv:studio-prefill', { detail: clean }));
  }
  return clean;
}

/**
 * Read (and clear) the staged payload for a given route.
 * Returns null when nothing is staged or it belongs to a different route.
 */
export function consumeStudioPrefill(route) {
  let payload = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) payload = JSON.parse(raw);
  } catch {
    payload = window.__svStudioPrefill || null;
  }
  if (!payload || payload.route !== route) return null;

  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.__svStudioPrefill = null;
  return payload;
}

/** Non-destructive peek (used for analytics / logging only). */
export function peekStudioPrefill() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : window.__svStudioPrefill || null;
  } catch {
    return window.__svStudioPrefill || null;
  }
}
