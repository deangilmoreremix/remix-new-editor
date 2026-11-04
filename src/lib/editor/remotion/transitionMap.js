/**
 * Map the editor's Video Transitions (gl-transitions names, used for the
 * WebGL preview) to @remotion/transitions presentations for the Remotion
 * engine. Exact equivalents are used where Remotion ships one; everything
 * else uses the closest CSS presentation, and the editor shows
 * "exports as: X" so nothing is a surprise.
 *
 * GPU presentations (crosswarp, dissolve, ripple, …) use Remotion's
 * HtmlInCanvas, which is experimental and Chrome-only; when it isn't
 * available the composition falls back to the `fallback` CSS presentation.
 */

/** [presentation, props, gpu?] */
const EXACT = {
  fade: ['fade', {}],
  wipeLeft: ['wipe', { direction: 'from-right' }],
  wipeRight: ['wipe', { direction: 'from-left' }],
  wipeUp: ['wipe', { direction: 'from-bottom' }],
  wipeDown: ['wipe', { direction: 'from-top' }],
  directionalwipe: ['wipe', { direction: 'from-left' }],
  Directional: ['slide', { direction: 'from-right' }],
  'directional-easing': ['slide', { direction: 'from-right' }],
  slides: ['slide', { direction: 'from-right' }],
  splitSlideInHorizontal: ['slide', { direction: 'from-left' }],
  splitSlideInVertical: ['slide', { direction: 'from-top' }],
  x_axis_translation: ['slide', { direction: 'from-right' }],
  SimpleFlip: ['flip', { direction: 'from-left' }],
  GridFlip: ['flip', { direction: 'from-left' }],
  Fold: ['flip', { direction: 'from-left' }],
  angular: ['clock-wipe', {}],
  radial: ['clock-wipe', {}],
  Radial: ['clock-wipe', {}],
  circle: ['iris', {}],
  circleopen: ['iris', {}],
  CircleCrop: ['iris', {}],
  cube: ['cube', { direction: 'from-right' }],
  swap: ['swap', {}, true],
  crosswarp: ['crosswarp', {}, true],
  dissolve: ['dissolve', {}, true],
  ripple: ['ripple', {}, true],
  FilmBurn: ['film-burn', {}, true],
  burn: ['film-burn', {}, true],
  CrossZoom: ['cross-zoom', {}, true],
  zoomInOut: ['zoom-in-out', {}, true],
  SimpleZoom: ['zoom-in-out', {}, true],
  SimpleZoomOut: ['zoom-in-out', {}, true],
  LinearBlur: ['linear-blur', {}, true],
  DreamyZoom: ['dreamy-zoom', {}, true],
  BookFlip: ['book-flip', {}, true],
};

const CSS_PRESENTATIONS = new Set(['fade', 'slide', 'wipe', 'flip', 'clock-wipe', 'iris', 'cube', 'push-cut', 'none']);

/** Nearest CSS presentation by keyword, for names without an exact match. */
function nearest(name) {
  const n = String(name || '').toLowerCase();
  if (/wipe|blind|window|slice|static_wipe/.test(n)) return ['wipe', { direction: 'from-left' }];
  if (/slide|push|translation|swap|left|right|up|down/.test(n)) return ['slide', { direction: 'from-right' }];
  if (/flip|fold|page|curl|book/.test(n)) return ['flip', { direction: 'from-left' }];
  if (/circle|iris|heart|star|crop|zoomincircles/.test(n)) return ['iris', {}];
  if (/clock|radial|angular|pinwheel|polar/.test(n)) return ['clock-wipe', {}];
  if (/cube|rotate|revolve/.test(n)) return ['cube', { direction: 'from-right' }];
  return ['fade', {}];
}

/**
 * @returns {{ presentation, presentationProps, gpu, fallback, exact }}
 */
export function mapVideoTransition(name) {
  const hit = EXACT[name];
  const [presentation, presentationProps, gpu] = hit || nearest(name);
  const fallback = gpu ? (nearest(name)[0] === presentation ? 'fade' : nearest(name)[0]) : presentation;
  return {
    presentation,
    presentationProps,
    gpu: !!gpu,
    fallback: CSS_PRESENTATIONS.has(fallback) ? fallback : 'fade',
    exact: !!hit,
  };
}

const LABELS = {
  fade: 'Fade', slide: 'Slide', wipe: 'Wipe', flip: 'Flip', 'clock-wipe': 'Clock wipe', iris: 'Iris', cube: 'Cube',
  swap: 'Swap', crosswarp: 'Crosswarp', dissolve: 'Dissolve', ripple: 'Ripple', 'film-burn': 'Film burn',
  'cross-zoom': 'Cross zoom', 'zoom-in-out': 'Zoom in/out', 'linear-blur': 'Linear blur', 'dreamy-zoom': 'Dreamy zoom',
  'book-flip': 'Book flip', 'push-cut': 'Push cut', none: 'Cut',
};

export const presentationLabel = (p) => LABELS[p] || p;
