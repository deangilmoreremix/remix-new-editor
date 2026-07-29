// Standalone UI helper used by the timeline editor (e.g. SceneDetector).
// Kept intentionally lightweight and free of any external "feature" deps
// (previously lived in timelineRendererEnhanced.js, which pulled in the
// popcorn-player tree and broke the production build).

/**
 * Rounded container with gradient background and blur, used by timeline
 * panels (e.g. SceneDetector). Mirrors the design pattern from DirectorPage.
 * @param {string} children - inner HTML
 * @param {string} className - extra classes
 * @returns {HTMLDivElement}
 */
export function createSurface(children = '', className = '') {
  const div = document.createElement('div');
  div.className = `rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.028))] shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl ${className}`;
  div.innerHTML = children;
  return div;
}
