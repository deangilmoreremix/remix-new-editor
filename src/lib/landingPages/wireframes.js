/**
 * Miniature wireframes of each page structure, shown on the template cards in the studio so a layout is
 * recognisable by its SHAPE and not just its colours. Static markup only (no user data), 120 x 76 viewBox,
 * drawn with `currentColor` so the card's accent tints it.
 */
const R = (x, y, w, h, o = 0.9, rx = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="currentColor" opacity="${o}"/>`;
const L = (x, y, w, o = 0.35) => R(x, y, w, 3, o, 1.5);
const PLAY = (cx, cy, r = 6) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity=".92"/><path d="M${cx - 2} ${cy - 3}l5 3-5 3z" fill="currentColor"/>`;

const SHAPES = {
  stack: [L(34, 8, 52, 0.6), L(44, 14, 32), R(30, 22, 60, 34, 0.9), R(50, 61, 20, 7, 0.9, 3.5), PLAY(60, 39)],
  split: [L(10, 12, 38, 0.6), L(10, 18, 28), R(10, 26, 20, 7, 0.9, 3.5), R(58, 10, 52, 30, 0.9), PLAY(84, 25), R(10, 48, 100, 20, 0.2)],
  minimal: [R(24, 8, 72, 40, 0.9), PLAY(60, 28), L(38, 55, 44, 0.6), R(50, 63, 20, 6, 0.9, 3)],
  intro: [R(8, 6, 8, 6, 0.8), L(20, 8, 30), L(34, 18, 52, 0.7), R(26, 26, 68, 22, 0.9), PLAY(60, 37, 5), R(8, 54, 56, 16, 0.2), R(70, 54, 42, 16, 0.35)],
  pitch: [R(8, 6, 8, 6, 0.8), L(8, 16, 46, 0.7), R(8, 24, 70, 28, 0.9), PLAY(43, 38, 5), R(8, 56, 12, 6, 0.6, 3), R(24, 56, 16, 6, 0.9, 3), R(8, 65, 70, 8, 0.2), R(84, 24, 28, 49, 0.3)],
  'cinema-hero': [R(0, 0, 120, 76, 0.9, 0), PLAY(60, 24, 7), R(8, 40, 64, 7, 0.0), `<rect x="0" y="34" width="120" height="42" fill="#000" opacity=".55"/>`, R(8, 40, 68, 6, 0.95, 1.5), R(8, 49, 44, 4, 0.6, 2), R(8, 58, 22, 7, 0.95, 3.5), R(34, 58, 18, 7, 0.4, 3.5), R(0, 71, 120, 5, 0.25, 0)],
  'split-screen': [R(0, 0, 46, 76, 0.85, 0), L(6, 10, 30, 0.0), `<rect x="6" y="14" width="34" height="3" rx="1.5" fill="#fff" opacity=".8"/>`, `<rect x="6" y="20" width="26" height="3" rx="1.5" fill="#fff" opacity=".5"/>`, `<rect x="6" y="28" width="34" height="20" rx="2" fill="#fff" opacity=".9"/>`, PLAY(23, 38, 4), `<rect x="6" y="54" width="14" height="6" rx="3" fill="#fff" opacity=".8"/>`, L(54, 10, 50, 0.6), L(54, 16, 40), L(54, 22, 46), R(54, 32, 56, 22, 0.25), R(54, 58, 56, 14, 0.15)],
  conversation: [R(14, 4, 92, 9, 0.25, 2), R(14, 17, 44, 7, 0.55, 3.5), R(14, 27, 60, 6, 0.3, 3), R(14, 36, 44, 22, 0.9, 4), PLAY(36, 47, 4), R(14, 61, 16, 6, 0.55, 3), R(33, 61, 18, 6, 0.3, 3), R(10, 70, 100, 5, 0.3, 2.5)],
  'app-window': [R(6, 5, 108, 66, 0.12, 3), R(6, 5, 108, 7, 0.3, 3), `<circle cx="12" cy="8.5" r="1.3" fill="currentColor"/><circle cx="17" cy="8.5" r="1.3" fill="currentColor"/><circle cx="22" cy="8.5" r="1.3" fill="currentColor"/>`, R(6, 12, 22, 59, 0.28, 0), L(9, 18, 14, 0.6), L(9, 25, 12), L(9, 32, 14), R(33, 17, 50, 28, 0.9), PLAY(58, 31, 4), R(33, 50, 22, 6, 0.55, 3), R(33, 59, 50, 9, 0.2), R(88, 17, 22, 51, 0.3)],
};

export const WIREFRAME_LAYOUTS = Object.freeze(Object.keys(SHAPES));

/** SVG markup for a layout's wireframe (falls back to the stacked page). */
export function wireframeSvg(layout) {
  const shapes = SHAPES[layout] || SHAPES.stack;
  return `<svg viewBox="0 0 120 76" width="100%" height="100%" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${shapes.join('')}</svg>`;
}
