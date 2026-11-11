/**
 * HyperFrames timeline library: feature flag. OFF by default.
 *
 * ON when the build sets VITE_HYPERFRAMES_TIMELINE=true, or (for QA on a deployed build) when
 * localStorage "remix.hyperframes.v1" is "1". Anything else, including a storage error, is OFF.
 *
 * The flag only controls whether customers can ADD HyperFrames animations (library entry points). A saved project
 * that already contains HyperFrames overlays keeps them and renders them either way, so turning the flag off never
 * silently deletes customer content; see docs/hyperframes-timeline-integration.md for rollback.
 */
export function isHyperframesEnabled() {
  try {
    if (import.meta.env?.VITE_HYPERFRAMES_TIMELINE === 'true') return true;
  } catch { /* import.meta.env unavailable */ }
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('remix.hyperframes.v1') === '1';
  } catch {
    return false;
  }
}

/**
 * Two separate off-switches (saved HyperFrames data is never deleted or rewritten by either):
 *  - CATALOG disable: the flag above is off, or ids are listed in catalog.disabled.json. Customers can no longer ADD those
 *    animations (library hides them) but projects that already contain them keep rendering and exporting.
 *  - EMERGENCY runtime disable (this function): no HyperFrames script runs anywhere (preview and export). Saved overlays stay in
 *    the project untouched; the editor shows a notice and exports that contain HyperFrames layers are refused instead of
 *    silently dropping them. Evaluated in the editor page and passed to the sandbox frames inside each layer
 *    (`runtimeDisabled`), because the sandboxed frames cannot read localStorage.
 */
export function isHyperframesRuntimeDisabled() {
  try {
    if (import.meta.env?.VITE_HYPERFRAMES_RUNTIME_DISABLED === 'true') return true;
  } catch { /* import.meta.env unavailable */ }
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('remix.hyperframes.kill') === '1';
  } catch {
    return false;
  }
}
