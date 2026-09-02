/**
 * Template Generator constants
 *
 * Defines the canonical entity keys and segment identifiers used by the
 * Template Generator modal. These mirror the upstream legacy
 * `lib/constants/templateGenerator.js` so future migrations to a
 * PresetStore-backed Niche Script library remain compatible.
 */

export const entityKeys = {
  NICHE_SCRIPT: 'nicheScript',
  OVERLAY: 'overlay',
  VIDEO: 'video',
  TEMPLATE: 'template',
};

export const templateSegments = {
  NICHE_SCRIPTS: 'nicheScripts',
  TEMPLATES: 'templates',
  OVERLAYS: 'overlays',
  TRANSITIONS: 'transitions',
};

export const templateSteps = {
  NICHE: 1,
  SCRIPT: 2,
  TEMPLATE: 3,
  MEDIA: 4,
  OVERLAYS: 5,
  VOICE: 6,
  PERSONALIZATION: 7,
  PREVIEW: 8,
  ADD_TO_TIMELINE: 9,
};

export const MAX_SELECTED_VIDEOS = 5;
export const MIN_VIDEOS_FOR_TRANSITIONS = 2;
export const DEFAULT_TRANSITION_DURATION = 1;
export const DEFAULT_CLIP_DURATION = 5;
