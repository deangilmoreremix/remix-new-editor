/**
 * Pointer designs for the opt-in form's hint ("arrow + bubble").
 *
 * Upstream (popcorn.retarget.js) hard-coded one red curly arrow
 * (fill #EB5054) at the bottom-right pointing up-left at the form. Here the
 * arrow is a registry of SVG designs that all share one 129×72 viewBox, one
 * anchor (tail bottom-right, head up-left) and one recolour hook, so the
 * creator picks a design and a colour and the position presets can mirror it.
 */

const CURLY_PATH = 'M68.7705 61.9585C53.6729 59.1867 41.6596 54.1241 38.166 48.8973C35.213 44.4916 34.8473 38.2327 37.1133 31.2063C31.303 29.1839 25.7175 26.491 21.0438 23.5385C17.1984 21.1142 14.4246 18.6122 12.4284 16.4156L13.8427 21.5047C14.0613 22.3073 13.5957 23.1267 12.8029 23.3472C12.0002 23.5658 11.1808 23.1002 10.9505 22.3056L7.44816 9.70597C7.40279 9.56547 7.37889 9.41874 7.37647 9.26579C7.37666 9.15398 7.39472 9.05563 7.41278 8.95727C7.47137 8.69352 7.5952 8.46207 7.76279 8.26916C7.8515 8.17361 7.94824 8.0897 8.06466 8.00941C8.34225 7.82653 8.69391 7.73858 9.0516 7.78392C9.0516 7.78392 9.0516 7.78392 9.06144 7.78573C9.06144 7.78573 9.08111 7.78934 9.09094 7.79114L23.0426 9.66127C23.8662 9.77181 24.4391 10.5277 24.3286 11.3513C24.218 12.1748 23.4621 12.7478 22.6386 12.6372L12.0617 11.2139C13.8588 13.7196 16.9972 17.4476 22.6376 21.0046C27.0754 23.802 32.5045 26.4052 38.1531 28.3674C41.5023 20.2589 47.5757 13.3725 53.1296 11.586C59.2355 9.22987 67.6878 9.76499 73.5883 12.9021C76.7571 14.5819 78.7336 16.7749 79.3 19.2275C80.5127 24.4727 75.5281 29.6375 65.2843 33.7655C65.2413 33.778 65.1984 33.7904 65.1536 33.8127C58.1439 35.9419 48.9206 34.8992 39.9605 32.1459C38.7213 36.0158 37.466 42.4651 40.6581 47.2299C47.432 57.3495 96.567 67.9973 119.951 54.9861C120.676 54.5803 121.593 54.8503 121.99 55.5638C122.396 56.289 122.138 57.1973 121.412 57.603C110.451 63.7038 92.9863 65.5708 73.4882 62.7332C71.884 62.4997 70.3147 62.2421 68.7705 61.9585ZM41.01 29.3088C49.3587 31.8482 57.8952 32.8664 64.2221 30.9677C72.6454 27.5628 77.1756 23.433 76.3687 19.9093C76.0145 18.3497 74.519 16.8043 72.175 15.5606C67.9223 13.3055 60.4579 11.9859 54.1238 14.4222C49.4013 15.9444 44.0348 22.1371 41.01 29.3088Z';

const STROKE = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';

/**
 * Each design: { id, label, svg(color) → inner SVG markup (viewBox 0 0 129 72) }.
 * `animated` designs get a CSS class so the pointer gently moves.
 */
export const POINTER_DESIGNS = [
  { id: 'curly', label: 'Curly (classic)', svg: (c) => `<path d="${CURLY_PATH}" fill="${c}"/>` },
  {
    id: 'straight',
    label: 'Straight',
    svg: (c) => `<path d="M120 62 L26 18" ${STROKE} stroke="${c}" stroke-width="5"/><path d="M10 10 L36 12 L24 34 Z" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: 'bold',
    label: 'Bold block',
    svg: (c) => `<g transform="rotate(24 64 36)"><path d="M6 36 L40 6 L40 26 L122 26 L122 46 L40 46 L40 66 Z" fill="${c}"/></g>`,
  },
  {
    id: 'dashed',
    label: 'Dashed curve',
    svg: (c) => `<path d="M122 60 Q64 70 26 26" ${STROKE} stroke="${c}" stroke-width="4.5" stroke-dasharray="2 9"/><path d="M10 10 L36 12 L24 34 Z" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: 'loop',
    label: 'Loop-the-loop',
    svg: (c) => `<path d="M122 62 C96 68 66 60 74 44 C82 28 104 40 88 54 C72 68 40 50 24 24" ${STROKE} stroke="${c}" stroke-width="4.5"/><path d="M10 10 L36 12 L24 34 Z" fill="${c}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: 'sketch',
    label: 'Hand-drawn',
    svg: (c) => `<path d="M121 58 C104 50 92 62 76 50 S46 36 24 22" ${STROKE} stroke="${c}" stroke-width="4"/><path d="M26 24 C20 20 16 16 9 9 M9 9 C17 10 25 11 33 9 M9 9 C11 17 13 25 12 33" ${STROKE} stroke="${c}" stroke-width="4"/>`,
  },
  {
    id: 'cursor',
    label: 'Mouse cursor',
    animated: true,
    svg: (c) => `<g transform="translate(6 2) scale(1.05)"><path d="M10 6 L10 56 L24 44 L34 66 L44 61 L34 40 L52 40 Z" fill="${c}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/></g>`,
  },
  {
    id: 'chevrons',
    label: 'Chevrons',
    animated: true,
    svg: (c) => `<g ${STROKE} stroke="${c}" stroke-width="6"><path d="M60 52 L30 30 L60 8"/><path d="M92 62 L62 40 L92 18"/><path d="M122 66 L92 44 L122 22"/></g>`,
  },
  { id: 'none', label: 'No arrow', svg: () => '' },
];

export const POINTER_DESIGN_IDS = POINTER_DESIGNS.map((d) => d.id);

export function getPointerDesign(id) {
  return POINTER_DESIGNS.find((d) => d.id === id) || POINTER_DESIGNS[0];
}

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

/** Ready-made colour schemes: pick one to set arrow + bubble together. */
export const POINTER_THEMES = [
  { id: 'classic', label: 'Classic red', pointerColor: '#eb5054', hintBackground: '#17171c', hintBorderColor: '#575773', hintTextColor: '#ffffff' },
  { id: 'cyan', label: 'Cyan glow', pointerColor: '#22d3ee', hintBackground: '#06222b', hintBorderColor: '#22d3ee', hintTextColor: '#e6fbff' },
  { id: 'lime', label: 'Lime', pointerColor: '#d4ff00', hintBackground: '#1a1d05', hintBorderColor: '#d4ff00', hintTextColor: '#fbffe0' },
  { id: 'violet', label: 'Violet', pointerColor: '#a78bfa', hintBackground: '#1b1430', hintBorderColor: '#a78bfa', hintTextColor: '#f3efff' },
  { id: 'light', label: 'Light', pointerColor: '#111827', hintBackground: '#ffffff', hintBorderColor: '#d1d5db', hintTextColor: '#111827' },
];
