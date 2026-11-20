/**
 * Text effects Smart Text offers on top of the Animate.css set (upstream's text manifest listed Typing, Blur and Flicker/Type Blink
 * "transitions" but switched them off and shipped no motion for them). The names are Animate.css-style class names: the editor and the
 * player play them with CSS keyframes (styles/timeline-addons.css), the export with the same poses (remotion/overlayAnimations.js).
 */
import { OVERLAY_ANIMATIONS } from './overlayData.js';

export const TEXT_EFFECTS = {
  in: [['typing', 'Typing'], ['blurIn', 'Blur In']],
  idle: [['flicker', 'Flicker'], ['blink', 'Blink']],
  out: [],
};

/** The in / idle / out lists for Smart Text: the new effects first, then every Animate.css one. */
export const TEXT_ANIMATIONS = {
  in: [...TEXT_EFFECTS.in, ...OVERLAY_ANIMATIONS.in],
  idle: [...TEXT_EFFECTS.idle, ...OVERLAY_ANIMATIONS.idle],
  out: [...TEXT_EFFECTS.out, ...OVERLAY_ANIMATIONS.out],
};
