// SPDX-License-Identifier: AGPL-3.0-or-later
// [remix] Transition type names from OpenChatCut (apps/video-agent-studio/src/editor/transitionTypes.ts), reduced to the
// pieces the vendored GL engine needs. Upstream: OpenChatCut contributors, AGPL-3.0-or-later.

/** transitions with a CSS fallback for non-texturable DOM clips. */
export type CssTransitionType =
  | 'cross-dissolve'
  | 'dip-to-black'
  | 'soft-wipe'
  | 'whip-pan'
  | 'flash'
  | 'luma-blend';

/** these video transitions run their real GLSL for video/image clips. */
export type GlslTransitionType =
  | CssTransitionType
  | 'page-curl'
  | 'rack-focus'
  | 'organic-dissolve'
  | 'impact-shake'
  | 'anticipation-zoom'
  | 'clean-line-wipe'
  | 'circle-wipe'
  | 'radial-blur'
  | 'glitch-cut'
  | 'dip-to-color';

export const GLSL_TRANSITION_TYPES: ReadonlySet<string> = new Set<string>([
  'cross-dissolve', 'dip-to-black', 'soft-wipe', 'whip-pan', 'flash', 'luma-blend',
  'page-curl', 'rack-focus', 'organic-dissolve', 'impact-shake', 'anticipation-zoom', 'clean-line-wipe',
  'circle-wipe', 'radial-blur', 'glitch-cut', 'dip-to-color',
]);

export type TransitionDirection = 'left' | 'right' | 'up' | 'down';
