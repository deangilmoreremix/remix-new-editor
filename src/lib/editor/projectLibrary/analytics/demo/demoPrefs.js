/**
 * Whether the person removed the DEMO videos from the Analytics tab. Kept in this browser only (localStorage), because the
 * demos are not stored anywhere: "remove" just stops showing them, and "show them again" brings them back.
 * Storage can be blocked (private windows, site data off), so the answer is also kept in memory for the visit.
 */
export const DEMOS_HIDDEN_KEY = 'remix_analytics_demos_hidden';
export const DEMOS_CHANGED_EVENT = 'remix:analytics-demos-changed';

let memory = false;

export function demosHidden(storage = globalThis.localStorage) {
  try { return storage?.getItem(DEMOS_HIDDEN_KEY) === '1' || memory; } catch { return memory; }
}

export function setDemosHidden(hidden, { storage = globalThis.localStorage, target = globalThis.window } = {}) {
  memory = !!hidden;
  try { if (hidden) storage?.setItem(DEMOS_HIDDEN_KEY, '1'); else storage?.removeItem(DEMOS_HIDDEN_KEY); } catch { /* storage unavailable: the in-memory answer still holds for this visit */ }
  try { target?.dispatchEvent(new Event(DEMOS_CHANGED_EVENT)); } catch { /* no window */ }
}
