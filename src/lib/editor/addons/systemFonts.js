/**
 * Fonts installed on this computer, through the browser's Local Font Access API (Chromium: `queryLocalFonts`). The browser asks the user
 * once, and only when the button is pressed; nothing is read before that. The list of names is kept in localStorage so it is there next
 * time without asking again (the browser remembers the permission). Only the NAMES are used: the text is drawn with the font the
 * computer already has, so a viewer on another device sees a fallback font, and the font file is never copied.
 * (OpenChatCut's own systemFonts.ts asks a desktop backend (/api/system-fonts), which this web app does not have.)
 */
const KEY = 'remix-system-fonts';
let cache = null;
const listeners = new Set();

const clean = (list) => [...new Set((Array.isArray(list) ? list : []).filter((n) => typeof n === 'string' && n.trim() && n.length <= 160).map((n) => n.trim()))].sort((a, b) => a.localeCompare(b));

export const supportsSystemFonts = () => typeof window !== 'undefined' && typeof window.queryLocalFonts === 'function';

/** Names loaded so far (from this session, or saved from an earlier one). */
export function systemFontFamilies() {
  if (cache) return cache;
  try { cache = clean(JSON.parse(globalThis.localStorage?.getItem(KEY) || '[]')); } catch { cache = []; }
  return cache;
}

export const onSystemFonts = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Ask the browser for the installed fonts (shows its permission prompt the first time). Resolves with the family names. */
export async function loadSystemFonts() {
  if (!supportsSystemFonts()) throw new Error('This browser cannot list the fonts on your computer. Use Chrome or Edge, or import a font file.');
  let faces;
  try { faces = await window.queryLocalFonts(); } catch (e) {
    throw new Error(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'Permission to read your fonts was not given.' : 'Could not read the fonts on this computer.');
  }
  cache = clean(faces.map((f) => f.family));
  try { globalThis.localStorage?.setItem(KEY, JSON.stringify(cache)); } catch { /* storage is optional */ }
  listeners.forEach((fn) => fn(cache));
  return cache;
}

/** When the user already allowed it, refresh the list quietly (no prompt). */
export async function refreshSystemFontsIfAllowed() {
  if (!supportsSystemFonts() || !navigator.permissions?.query) return systemFontFamilies();
  try {
    const status = await navigator.permissions.query({ name: 'local-fonts' });
    if (status.state === 'granted') return await loadSystemFonts();
  } catch { /* the permission name is not known to this browser */ }
  return systemFontFamilies();
}
