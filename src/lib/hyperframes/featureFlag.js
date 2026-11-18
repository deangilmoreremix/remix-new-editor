/**
 * Animations library: ON for everyone. The only way to hide the library entry point on one browser (QA) is localStorage
 * "remix.hyperframes.v1" = "0". A storage error leaves it ON. Any other value (or none) is ON.
 * The old build variable VITE_HYPERFRAMES_TIMELINE no longer matters: it used to turn the feature ON, and an existing "false" in a
 * deploy environment must not switch the library off.
 *
 * This only controls whether customers can ADD animations (library entry point). A saved project that already contains animation
 * overlays keeps them and renders them either way. The emergency kill switch below (isHyperframesRuntimeDisabled) is separate.
 */
export function isHyperframesEnabled() {
  try {
    return !(typeof localStorage !== 'undefined' && localStorage.getItem('remix.hyperframes.v1') === '0');
  } catch {
    return true;
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
