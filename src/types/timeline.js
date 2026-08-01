/**
 * @typedef {'video' | 'audio'} TrackKind
 */

/**
 * @typedef {'select' | 'trackForward' | 'blade' | 'ripple' | 'roll' | 'slip' | 'slide' | 'music' | 'fillGap' | 'extend' | 'mask'} ToolType
 */

export const DEFAULT_VIDEO_COLOR = '#4a9fd6';
export const DEFAULT_AUDIO_COLOR = '#5bbf5b';

export const TRACK_COLORS = [
  '#4a9fd6', '#5bbf5b', '#e74c3c', '#9b59b6', '#e67e22',
  '#1abc9c', '#f39c12', '#d466a8', '#e91e63', '#5bc5c5',
];

/**
 * @typedef {Object} Track
 * @property {string} id
 * @property {string} name
 * @property {TrackKind} kind
 * @property {string} color
 * @property {boolean} muted
 * @property {boolean} solo
 * @property {boolean} locked
 * @property {boolean} visible
 * @property {number} volume
 */

/**
 * @typedef {Object} Clip
 * @property {string} id
 * @property {string} assetId
 * @property {string} trackId
 * @property {string} name
 * @property {number} startTime
 * @property {number} duration
 * @property {number} trimStart
 * @property {number} trimEnd
 * @property {number} speed - 0.25–4, default 1
 * @property {number} opacity - 0–1, default 1
 * @property {number} volume - 0–2, default 1 (1 = unity, >1 = boost)
 * @property {boolean} flipH
 * @property {boolean} flipV
 * @property {Keyframe[]} keyframes
 * @property {string[]} [linkedClipIds] - linked video↔audio pairs (supports multiple linked clips)
 */

/**
 * @typedef {Object} Keyframe
 * @property {number} time - relative to clip's visible window (0 = first visible frame)
 * @property {'opacity' | 'volume'} property
 * @property {number} value
 */

/**
 * @typedef {Object} Transition
 * @property {string} id
 * @property {'dissolve' | 'fadeToBlack' | 'fadeFromBlack'} type
 * @property {number} duration
 * @property {string} clipAId
 * @property {string} [clipBId] - undefined for fades (single-clip)
 */

/**
 * @typedef {Object} TimelineMarker
 * @property {string} id
 * @property {number} time
 * @property {string} color
 * @property {string} label
 */

/**
 * @typedef {Object} Timeline
 * @property {string} id
 * @property {string} name
 * @property {Track[]} tracks
 * @property {Clip[]} clips
 * @property {number} duration
 * @property {Transition[]} transitions
 * @property {TimelineMarker[]} markers
 */

/**
 * Effective duration of a clip (what plays on the timeline).
 * @param {Clip} clip
 * @returns {number}
 */
export function clipEffectiveDuration(clip) {
  return (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed;
}

/**
 * End time of a clip on the timeline.
 * @param {Clip} clip
 * @returns {number}
 */
export function clipEndTime(clip) {
  return clip.startTime + clipEffectiveDuration(clip);
}

/**
 * @typedef {Object} EditorLayout
 * @property {number} leftPanelWidth
 * @property {'full' | 'compact'} leftPanelMode
 * @property {number} viewerTimelineSplit
 * @property {number} sourceTimelineSplit
 * @property {boolean} sourceViewerVisible
 * @property {number} rightPanelWidth
 * @property {boolean} inspectorVisible
 */

export const DEFAULT_EDITOR_LAYOUT = {
  leftPanelWidth: 240,
  leftPanelMode: 'full',
  viewerTimelineSplit: 0.55,
  sourceTimelineSplit: 0.5,
  sourceViewerVisible: true,
  rightPanelWidth: 280,
  inspectorVisible: false,
};
