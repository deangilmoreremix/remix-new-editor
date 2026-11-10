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
