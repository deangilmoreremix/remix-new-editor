/**
 * Pointer designs, motions, bubble styles and colour schemes for the opt-in
 * form's hint ("pointer + bubble").
 *
 * Upstream (popcorn.retarget.js) hard-coded one red curly arrow
 * (fill #EB5054) at the bottom-right pointing up-left at the form. Here the
 * pointer is a registry:
 *
 *  - ARROW designs share one 129×72 viewBox, one anchor (tail bottom-right,
 *    head up-left) and one recolour hook, so the position presets can mirror
 *    them. They are animated by a motion preset (nudge, bounce, draw-on …).
 *  - TARGET designs (cursor, hand, ripple) are placed ON the Play button and
 *    play a click demo — ported from two animation sources in this repo:
 *      · HyperFrames `cta-morph-press` / `physics-press-reaction`: the cursor
 *        hard-cuts in from the bottom-right, travels to the button, presses
 *        down (scale 0.9) and springs back in sync with the button.
 *      · Remotion `ScreenshotScene`: ease-out-cubic cursor travel, the
 *        CursorArrow shape and the expanding `click_pulse` ripple
 *        (10 → 80px, alpha 0.85 → 0).
 */

const CURLY_PATH = 'M68.7705 61.9585C53.6729 59.1867 41.6596 54.1241 38.166 48.8973C35.213 44.4916 34.8473 38.2327 37.1133 31.2063C31.303 29.1839 25.7175 26.491 21.0438 23.5385C17.1984 21.1142 14.4246 18.6122 12.4284 16.4156L13.8427 21.5047C14.0613 22.3073 13.5957 23.1267 12.8029 23.3472C12.0002 23.5658 11.1808 23.1002 10.9505 22.3056L7.44816 9.70597C7.40279 9.56547 7.37889 9.41874 7.37647 9.26579C7.37666 9.15398 7.39472 9.05563 7.41278 8.95727C7.47137 8.69352 7.5952 8.46207 7.76279 8.26916C7.8515 8.17361 7.94824 8.0897 8.06466 8.00941C8.34225 7.82653 8.69391 7.73858 9.0516 7.78392C9.0516 7.78392 9.0516 7.78392 9.06144 7.78573C9.06144 7.78573 9.08111 7.78934 9.09094 7.79114L23.0426 9.66127C23.8662 9.77181 24.4391 10.5277 24.3286 11.3513C24.218 12.1748 23.4621 12.7478 22.6386 12.6372L12.0617 11.2139C13.8588 13.7196 16.9972 17.4476 22.6376 21.0046C27.0754 23.802 32.5045 26.4052 38.1531 28.3674C41.5023 20.2589 47.5757 13.3725 53.1296 11.586C59.2355 9.22987 67.6878 9.76499 73.5883 12.9021C76.7571 14.5819 78.7336 16.7749 79.3 19.2275C80.5127 24.4727 75.5281 29.6375 65.2843 33.7655C65.2413 33.778 65.1984 33.7904 65.1536 33.8127C58.1439 35.9419 48.9206 34.8992 39.9605 32.1459C38.7213 36.0158 37.466 42.4651 40.6581 47.2299C47.432 57.3495 96.567 67.9973 119.951 54.9861C120.676 54.5803 121.593 54.8503 121.99 55.5638C122.396 56.289 122.138 57.1973 121.412 57.603C110.451 63.7038 92.9863 65.5708 73.4882 62.7332C71.884 62.4997 70.3147 62.2421 68.7705 61.9585ZM41.01 29.3088C49.3587 31.8482 57.8952 32.8664 64.2221 30.9677C72.6454 27.5628 77.1756 23.433 76.3687 19.9093C76.0145 18.3497 74.519 16.8043 72.175 15.5606C67.9223 13.3055 60.4579 11.9859 54.1238 14.4222C49.4013 15.9444 44.0348 22.1371 41.01 29.3088Z';

// `pathLength="1"` lets the "draw on" motion animate any stroke the same way.
const S = (c, w, extra = '') => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" class="pt-stroke" ${extra}`;
// Arrow heads fade in after the stroke has been drawn.
const HEAD = (c, d = 'M10 10 L36 12 L24 34 Z') => `<path class="pt-head" d="${d}" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`;

// Remotion CursorArrow (ScreenshotScene.tsx) and the HyperFrames cursor
// (cta-morph-press.html) outlines, both in a 24×24 box.
const REMOTION_CURSOR = 'M2 2 L2 16 L6 12 L8.5 17 L10.5 16 L8 11 L13 11 Z';
const HYPERFRAMES_CURSOR = 'M5.5 3.5L19 10.5L11.5 12.5L15.5 19.5L13.5 20.5L9.5 13.5L5.5 17.5V3.5Z';
const HAND = 'M9 11.2V4.6a1.6 1.6 0 0 1 3.2 0V10h.6a1.6 1.6 0 0 1 1.6-1.4h.5a1.6 1.6 0 0 1 1.6 1.4h.4a1.6 1.6 0 0 1 1.6 1.6v4.2c0 3.3-2.4 5.9-5.6 5.9h-1.2c-1.9 0-3.4-.9-4.5-2.3l-2.6-3.6a1.5 1.5 0 0 1 2.3-1.9L9 15.1z';

/**
 * Each design: { id, label, category, svg(color) → inner markup }.
 *  - mode 'arrow' (default): placed by the hint corner, viewBox 129×72.
 *  - mode 'target': placed on the Play button; viewBox is its own; `tip` is
 *    where the pointer's tip sits inside the box (0–1), `cursor:false` = ring only.
 *  - `animated`: has its own built-in motion even with motion "none".
 */
export const POINTER_DESIGNS = [
  // ---- Arrows (tail bottom-right, head up-left) -------------------------
  { id: 'curly', label: 'Curly (classic)', category: 'arrow', svg: (c) => `<path d="${CURLY_PATH}" fill="${c}"/>` },
  { id: 'straight', label: 'Straight', category: 'arrow', svg: (c) => `<path d="M120 62 L26 18" ${S(c, 5)}/>${HEAD(c)}` },
  { id: 'bold', label: 'Bold block', category: 'arrow', svg: (c) => `<g transform="rotate(24 64 36)"><path class="pt-head" d="M6 36 L40 6 L40 26 L122 26 L122 46 L40 46 L40 66 Z" fill="${c}"/></g>` },
  { id: 'dashed', label: 'Dashed curve', category: 'arrow', svg: (c) => `<path d="M122 60 Q64 70 26 26" fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="2 9"/>${HEAD(c)}` },
  { id: 'loop', label: 'Loop-the-loop', category: 'arrow', svg: (c) => `<path d="M122 62 C96 68 66 60 74 44 C82 28 104 40 88 54 C72 68 40 50 24 24" ${S(c, 4.5)}/>${HEAD(c)}` },
  { id: 'sketch', label: 'Hand-drawn', category: 'arrow', svg: (c) => `<path d="M121 58 C104 50 92 62 76 50 S46 36 24 22" ${S(c, 4)}/><path class="pt-head" d="M26 24 C20 20 16 16 9 9 M9 9 C17 10 25 11 33 9 M9 9 C11 17 13 25 12 33" ${S(c, 4)}/>` },
  { id: 'swoosh', label: 'Swoosh', category: 'arrow', svg: (c) => `<path class="pt-head" d="M124 62 C92 72 50 58 26 24 C54 50 94 60 124 62 Z" fill="${c}" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>${HEAD(c, 'M8 8 L34 14 L20 34 Z')}` },
  { id: 'brush', label: 'Brush stroke', category: 'arrow', svg: (c) => `<path d="M120 62 Q62 70 30 28" ${S(c, 9, 'opacity=".92"')}/>${HEAD(c, 'M6 6 L40 10 L24 40 Z')}` },
  { id: 'arc', label: 'Big arc', category: 'arrow', svg: (c) => `<path d="M122 64 A72 52 0 0 0 28 20" ${S(c, 5)}/>${HEAD(c)}` },
  { id: 'wave', label: 'Wavy', category: 'arrow', svg: (c) => `<path d="M122 56 C108 40 96 72 80 54 S56 36 42 42 S24 30 22 22" ${S(c, 4.5)}/>${HEAD(c)}` },
  { id: 'zigzag', label: 'Zig-zag', category: 'arrow', svg: (c) => `<path d="M122 62 L102 40 L86 58 L64 34 L48 50 L28 24" ${S(c, 4.5)}/>${HEAD(c)}` },
  { id: 'double', label: 'Double', category: 'arrow', svg: (c) => `<path d="M118 66 L34 26" ${S(c, 4)}/><path d="M124 52 L40 12" ${S(c, 4)}/>${HEAD(c, 'M32 22 L52 26 L40 40 Z')}${HEAD(c, 'M38 8 L58 12 L46 26 Z')}` },
  { id: 'neon', label: 'Neon glow', category: 'arrow', svg: (c) => `<path d="M118 62 Q64 70 28 26" ${S(c, 14, 'opacity=".22"')}/><path d="M118 62 Q64 70 28 26" ${S(c, 4.5)}/>${HEAD(c)}` },
  { id: 'trail', label: 'Dotted trail', category: 'arrow', svg: (c) => `<g class="pt-head" fill="${c}"><circle cx="118" cy="60" r="4.6"/><circle cx="104" cy="63" r="4.2"/><circle cx="89" cy="62" r="3.8"/><circle cx="75" cy="57" r="3.4"/><circle cx="62" cy="50" r="3"/><circle cx="50" cy="42" r="2.6"/></g>${HEAD(c, 'M10 10 L36 14 L22 34 Z')}` },
  { id: 'sparkle', label: 'Sparkle arrow', category: 'arrow', svg: (c) => `<path d="M118 62 L26 20" ${S(c, 4.5)}/>${HEAD(c)}<g class="pt-head" fill="${c}"><path d="M96 24 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z"/><path d="M110 48 l1.4 4 4 1.4 -4 1.4 -1.4 4 -1.4 -4 -4 -1.4 4 -1.4z"/><path d="M70 62 l1.2 3.4 3.4 1.2 -3.4 1.2 -1.2 3.4 -1.2 -3.4 -3.4 -1.2 3.4 -1.2z"/></g>` },
  { id: 'chevrons', label: 'Chevrons', category: 'arrow', animated: true, svg: (c) => `<g ${S(c, 6)}><path d="M60 52 L30 30 L60 8"/><path d="M92 62 L62 40 L92 18"/><path d="M122 66 L92 44 L122 22"/></g>` },
  { id: 'cursor', label: 'Mouse cursor', category: 'arrow', animated: true, svg: (c) => `<g transform="translate(6 2) scale(1.05)"><path d="M10 6 L10 56 L24 44 L34 66 L44 61 L34 40 L52 40 Z" fill="${c}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></g>` },

  // ---- Click demos: placed ON the Play button ---------------------------
  { id: 'click-cursor', label: 'Cursor clicks Play', category: 'target', mode: 'target', viewBox: '0 0 24 24', tip: [0.23, 0.15], svg: (c) => `<path d="${HYPERFRAMES_CURSOR}" fill="${c}" stroke="#f8fafc" stroke-width="1.5" stroke-linejoin="round"/>` },
  { id: 'click-light', label: 'Light cursor', category: 'target', mode: 'target', viewBox: '0 0 16 20', tip: [0.125, 0.1], svg: (c) => `<path d="${REMOTION_CURSOR}" fill="${c}" stroke="#111" stroke-width="1.2" stroke-linejoin="round"/>` },
  { id: 'click-hand', label: 'Finger taps Play', category: 'target', mode: 'target', viewBox: '0 0 24 24', tip: [0.44, 0.1], svg: (c) => `<path d="${HAND}" fill="${c}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>` },
  { id: 'ripple', label: 'Pulse ring', category: 'target', mode: 'target', cursor: false, viewBox: '0 0 24 24', tip: [0.5, 0.5], svg: () => '' },
  { id: 'none', label: 'No arrow', category: 'arrow', svg: () => '' },
];

export const POINTER_DESIGN_IDS = POINTER_DESIGNS.map((d) => d.id);

export function getPointerDesign(id) {
  return POINTER_DESIGNS.find((d) => d.id === id) || POINTER_DESIGNS[0];
}

export const isTargetDesign = (id) => getPointerDesign(id).mode === 'target';

/** Section headings for the design picker. */
export const POINTER_CATEGORIES = [
  ['arrow', 'Arrows'],
  ['target', 'Click demos (on the Play button)'],
];

/** Colours are interpolated into SVG markup — accept only plain CSS colours. */
export function safeColor(value, fallback = '#eb5054') {
  const v = String(value || '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|hsl)a?\([\d\s.,%/-]+\)$/i.test(v) ? v : fallback;
}

/** Inner SVG markup for a design in a colour. */
export function pointerSvg(designId, color) {
  return getPointerDesign(designId).svg(safeColor(color));
}

/** Where the hint bubble sits; the arrow mirrors to keep pointing at the form. */
export const HINT_POSITIONS = [
  ['bottom-right', 'Bottom right'],
  ['bottom-left', 'Bottom left'],
  ['top-right', 'Top right'],
  ['top-left', 'Top left'],
];

/**
 * Motions for ARROW designs (CSS animations on the pointer).
 *  nudge  – slides toward the form and back
 *  bounce – springy hop along the arrow's direction
 *  pulse  – gentle scale breathing
 *  wiggle – small rotation shake, then rest
 *  float  – slow drifting bob
 *  draw   – the stroke draws itself, then the head pops in (like GSAP DrawSVG)
 *  ping   – a ring ripples out from the arrow's tip
 */
export const POINTER_MOTIONS = [
  ['nudge', 'Nudge toward the form'],
  ['bounce', 'Bounce'],
  ['pulse', 'Pulse'],
  ['wiggle', 'Wiggle'],
  ['float', 'Float'],
  ['draw', 'Draw itself on'],
  ['ping', 'Ping ring'],
  ['none', 'Still'],
];

/**
 * Motions for CLICK-DEMO designs (Web Animations on the pointer + the button).
 *  travel-click – cursor cuts in from the corner, travels (ease-out cubic) to
 *                 Play, presses it (both scale to 0.9), springs back with a
 *                 ripple; loops. (HyperFrames physics-press-reaction + Remotion
 *                 ScreenshotScene click_pulse)
 *  tap          – parked on Play, taps over and over
 *  hover        – parked on Play, floating
 */
export const TARGET_MOTIONS = [
  ['travel-click', 'Travel in, then click'],
  ['tap', 'Tap Play repeatedly'],
  ['hover', 'Hover over Play'],
  ['none', 'Still'],
];

/** Look of the hint bubble. */
export const HINT_STYLES = [
  ['card', 'Card (classic)'],
  ['glass', 'Frosted glass'],
  ['speech', 'Speech bubble'],
  ['pill', 'Pill (short)'],
  ['neon', 'Neon outline'],
  ['solid', 'Solid color'],
  ['minimal', 'Minimal (text only)'],
];

/** Ready-made colour schemes: pick one to set arrow + bubble together. */
export const POINTER_THEMES = [
  { id: 'classic', label: 'Classic red', pointerColor: '#eb5054', hintBackground: '#17171c', hintBorderColor: '#575773', hintTextColor: '#ffffff' },
  { id: 'cyan', label: 'Cyan glow', pointerColor: '#22d3ee', hintBackground: '#06222b', hintBorderColor: '#22d3ee', hintTextColor: '#e6fbff' },
  { id: 'lime', label: 'Lime', pointerColor: '#d4ff00', hintBackground: '#1a1d05', hintBorderColor: '#d4ff00', hintTextColor: '#fbffe0' },
  { id: 'violet', label: 'Violet', pointerColor: '#a78bfa', hintBackground: '#1b1430', hintBorderColor: '#a78bfa', hintTextColor: '#f3efff' },
  { id: 'sunset', label: 'Sunset', pointerColor: '#fb923c', hintBackground: '#2a1405', hintBorderColor: '#fb923c', hintTextColor: '#fff1e5' },
  { id: 'mint', label: 'Mint', pointerColor: '#34d399', hintBackground: '#06251c', hintBorderColor: '#34d399', hintTextColor: '#e4fff5' },
  { id: 'pink', label: 'Hot pink', pointerColor: '#f472b6', hintBackground: '#2a0c1b', hintBorderColor: '#f472b6', hintTextColor: '#ffe9f4' },
  { id: 'gold', label: 'Gold', pointerColor: '#fbbf24', hintBackground: '#241a05', hintBorderColor: '#fbbf24', hintTextColor: '#fff6dc' },
  { id: 'ocean', label: 'Ocean', pointerColor: '#60a5fa', hintBackground: '#0b1a33', hintBorderColor: '#60a5fa', hintTextColor: '#eaf3ff' },
  { id: 'mono', label: 'White', pointerColor: '#ffffff', hintBackground: '#111111', hintBorderColor: '#ffffff', hintTextColor: '#ffffff' },
  { id: 'light', label: 'Light', pointerColor: '#111827', hintBackground: '#ffffff', hintBorderColor: '#d1d5db', hintTextColor: '#111827' },
];
