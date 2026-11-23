/**
 * MCP tab control for this app. A studio calls `setBridgeTools('timeline', tools)` while it is mounted (and `setBridgeTools('timeline', [])`
 * when it goes away); the small switch in the corner then offers "Let MCP control this tab". Nothing is announced to the server until
 * the user switches it on, and it is off again after a reload. See packages/studio-mcp-core/src/bridge-tab.js for the consent rules.
 */
import { createTabBridge } from '../../../packages/studio-mcp-core/src/bridge-tab.js';
import { getClerkSessionToken } from '../supabase.js';
import { mountBridgeUi, askConsent } from './ui.js';

export const MCP_BRIDGE_ENDPOINT = '/api/mcp-bridge';

let bridge = null;
const listeners = new Set();

export function getBridge() {
  if (bridge) return bridge;
  bridge = createTabBridge({
    endpoint: MCP_BRIDGE_ENDPOINT,
    label: typeof document !== 'undefined' ? (document.title || 'SmartVid tab').slice(0, 60) : 'SmartVid tab',
    getHeaders: async () => {
      const token = await getClerkSessionToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
    confirm: (info) => askConsent(info),
    onState: (s) => listeners.forEach((fn) => { try { fn(s); } catch { /* UI errors must not break polling */ } }),
  });
  return bridge;
}

export function onBridgeState(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Offer (or withdraw, with an empty list) one studio's tools. Safe to call before the user has switched anything on. */
export function setBridgeTools(studio, tools) {
  const b = getBridge();
  b.setTools(studio, tools);
  if (typeof document !== 'undefined') mountBridgeUi({ bridge: b, onState: onBridgeState });
}
