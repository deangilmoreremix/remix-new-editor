// src/lib/outreach/perfPresets.js
//
// Performance presets (requirement 50): three named settings and a suggestion for this device. The suggestion only
// reads what the browser already says about itself (memory, processor count, a data-saver or slow connection); nothing is
// measured by running a test and nothing is sent anywhere. The user can always choose another.

export const PERF_PRESETS = Object.freeze({
  light: { label: 'Light', quality: 'small', suggestFrames: 4, about: 'Smaller files and fewer frames to look at. Best for older phones and slow connections.' },
  balanced: { label: 'Balanced', quality: 'standard', suggestFrames: 8, about: 'The usual settings.' },
  best: { label: 'Best quality', quality: 'high', suggestFrames: 12, about: 'Larger files and more frames. Needs a recent computer.' },
});
export const PERF_KEY = 'outreach-perf-preset';

export const presetId = (id) => (Object.prototype.hasOwnProperty.call(PERF_PRESETS, id) ? id : 'balanced');

/** @returns {{ id:'light'|'balanced'|'best', reason:string }} */
export function recommendPreset(env = globalThis) {
  const nav = env.navigator || {};
  const mem = Number(nav.deviceMemory); const cores = Number(nav.hardwareConcurrency);
  const conn = nav.connection || {};
  if (conn.saveData === true) return { id: 'light', reason: 'Your browser has data saver on.' };
  if (['slow-2g', '2g', '3g'].includes(conn.effectiveType)) return { id: 'light', reason: 'Your connection looks slow.' };
  if (mem > 0 && mem <= 2) return { id: 'light', reason: `This device reports about ${mem} GB of memory.` };
  if (cores > 0 && cores <= 2) return { id: 'light', reason: `This device reports ${cores} processor core${cores === 1 ? '' : 's'}.` };
  if (mem >= 8 && cores >= 8) return { id: 'best', reason: `This device reports about ${mem} GB of memory and ${cores} cores.` };
  return { id: 'balanced', reason: mem > 0 || cores > 0 ? 'Nothing here suggests a limit.' : 'Your browser does not say how powerful this device is, so the usual settings are suggested.' };
}

/** The preset chosen on this device (remembered in this browser), or Balanced. */
export function chosenPreset(storage = globalThis.localStorage) {
  try { return presetId(storage?.getItem(PERF_KEY)); } catch { return 'balanced'; }
}
export function choosePreset(id, storage = globalThis.localStorage) {
  try { storage?.setItem(PERF_KEY, presetId(id)); return true; } catch { return false; }
}
