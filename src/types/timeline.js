export const DEFAULT_VIDEO_COLOR = '#4a9fd6';
export const DEFAULT_AUDIO_COLOR = '#5bbf5b';

export const TRACK_COLORS = [
  '#4a9fd6', '#5bbf5b', '#e74c3c', '#9b59b6', '#e67e22',
  '#1abc9c', '#f39c12', '#d466a8', '#e91e63', '#5bc5c5',
];

/**
 * @typedef {'video' | 'audio'} TrackKind
 */

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
 * @typedef {'video' | 'audio' | 'image' | 'text'} ClipType
 */

/**
 * @typedef {'blur' | 'sharpen' | 'glow' | 'vignette' | 'grain' | 'lut-cinematic' | 'lut-vintage' | 'lut-bw' | 'lut-cool' | 'lut-warm' | 'lut-muted' | 'lut-vivid'} EffectType
 */

/**
 * @typedef {Object} EffectMask
 * @property {boolean} enabled
 * @property {'rectangle' | 'ellipse'} shape
 * @property {number} x - 0-100 (%)
 * @property {number} y - 0-100 (%)
 * @property {number} width - 0-100 (%)
 * @property {number} height - 0-100 (%)
 * @property {number} feather - 0-100 (%)
 * @property {boolean} invert
 * @property {number} rotation - degrees
 */

/**
 * @typedef {Object} ClipEffect
 * @property {string} id
 * @property {EffectType} type
 * @property {boolean} enabled
 * @property {Record<string, number>} params
 * @property {EffectMask} [mask]
 */

/**
 * @typedef {Object} ColorCorrection
 * @property {number} brightness - -1 to 1, default 0
 * @property {number} contrast - -1 to 1, default 0
 * @property {number} saturation - -1 to 1, default 0
 * @property {number} temperature - -1 to 1, default 0
 * @property {number} tint - -1 to 1, default 0
 * @property {number} exposure - -1 to 1, default 0
 * @property {number} highlights - -1 to 1, default 0
 * @property {number} shadows - -1 to 1, default 0
 */

/**
 * @typedef {Object} LetterboxSettings
 * @property {boolean} enabled
 * @property {'2.35:1' | '2.39:1' | '2.76:1' | '1.85:1' | '4:3' | 'custom'} aspectRatio
 * @property {number} [customRatio] - width/height when aspectRatio is 'custom'
 * @property {string} color - hex color
 * @property {number} opacity - 0-100
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
 * @property {ClipType} [type] - explicit clip type (our own concept, not in CineGen)
 * @property {boolean} [muted] - independent of volume; when true the clip is silenced (our own concept)
 * @property {boolean} [reversed] - play clip content backwards (our own concept)
 * @property {ColorCorrection} [colorCorrection] - color grading applied to this clip (our own concept)
 * @property {LetterboxSettings} [letterbox] - letterbox/pillarbox framing for this clip (our own concept)
 * @property {ClipEffect[]} [effects] - non-destructive effects applied to this clip (our own concept)
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

export const DEFAULT_COLOR_CORRECTION = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
};

export const DEFAULT_LETTERBOX = {
  enabled: false,
  aspectRatio: '2.35:1',
  color: '#000000',
  opacity: 100,
};

export const DEFAULT_EFFECT_MASK = {
  enabled: false,
  shape: 'ellipse',
  x: 50,
  y: 50,
  width: 40,
  height: 40,
  feather: 20,
  invert: false,
  rotation: 0,
};
