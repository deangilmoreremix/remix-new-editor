export type TrackKind = 'video' | 'audio';

export type ToolType =
  | 'select'
  | 'trackForward'
  | 'blade'
  | 'ripple'
  | 'roll'
  | 'slip'
  | 'slide'
  | 'music'
  | 'fillGap'
  | 'extend'
  | 'mask';

export const DEFAULT_VIDEO_COLOR = '#4a9fd6';
export const DEFAULT_AUDIO_COLOR = '#5bbf5b';

export const TRACK_COLORS = [
  '#4a9fd6', '#5bbf5b', '#e74c3c', '#9b59b6', '#e67e22',
  '#1abc9c', '#f39c12', '#d466a8', '#e91e63', '#5bc5c5',
] as const;

export interface Track {
  id: string;
  name: string;
  kind: TrackKind;
  color: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  visible: boolean;
  volume: number;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  name: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  speed: number;          // 0.1–8 (OpenChatCut range), default 1
  opacity: number;        // 0–1, default 1
  volume: number;         // 0–2, default 1 (1 = unity, >1 = boost)
  flipH: boolean;
  flipV: boolean;
  keyframes: Keyframe[];
  /** [remix] OpenChatCut clip fade-in / fade-out, seconds (opacity on video, volume on audio; editor/clipFade.ts). */
  fadeIn?: number;
  fadeOut?: number;
  linkedClipIds?: string[];  // linked video↔audio pairs (supports multiple linked clips)
  // [remix] OpenChatCut effects: per-clip GL fx stack, LUT / look, blend mode (see src/openchatcut/gl).
  fx?: ClipFx[];
  lut?: { id: string; intensity: number; def?: import('../lib/occ/plugins').FxSnapshot };
  blendMode?: string;
  /** [remix] Smart Speech settings (text, provider, voice, per-contact variants) kept next to the generated audio so it can be regenerated */
  tts?: Record<string, unknown>;
  /** [remix] set on clips materialised from a multicam group */
  multicam?: { groupId: string; angleId: string };
  /** [remix] position / scale / rotation (+ tracked path) of the clip in the frame. */
  transform?: import('../lib/occ/transform').ClipTransform;
  /** [remix] OpenChatCut zoom / follow-subject reframe (their ZoomEffect). */
  zoom?: import('../../openchatcut/editor/types').ZoomEffect;
  /** [remix] OpenChatCut captions burned over this clip (words in timeline ms). */
  captions?: import('../../openchatcut/captions/types').CaptionsData;
  /** [remix] Stage 1: clips with the same groupId are selected / moved / deleted together (lib/editor/stage1/groups.ts) */
  groupId?: string;
  /** [remix] Stage 1: compound clip. The clip is one object on the timeline; its content (start times relative to the clip, original
   *  track ids) is expanded to ordinary clips for playback and export (lib/editor/stage1/compound.ts, flattenCompounds). */
  compound?: CompoundContent;
  /** [remix] Stage 4: 6-band parametric EQ (lib/audio/eq.ts). Preview: BiquadFilter chain; export: baked into the audio (lib/audio/eq-bake.ts). */
  eq?: import('../lib/audio/eq').ClipEq;
  /** [remix] Stage 2: unified keyframes (position, scale, rotation, opacity, crop, effect params; easing / bezier / spring) + procedural motion modifiers (lib/editor/stage2/anim.ts) */
  anim?: import('../lib/editor/stage2/anim').ClipAnim;
}

export interface CompoundContent { clips: Clip[]; transitions: Transition[] }

/** [remix] One OpenChatCut effect on a clip: id is an FX_EFFECTS key (builtin:fx-…), props = per-effect slider values. */
export interface ClipFx {
  id: string;
  /** plugin fx snapshot (openchatcut-plugin@1): keeps the project rendering without the pack installed */
  def?: import('../lib/occ/plugins').FxSnapshot;
  props: Record<string, number | number[]>;
  enabled?: boolean;
  /** [remix] animated effect properties: prop key → OpenChatCut Keyframe[] (frame at 30 fps from the clip start, value, easing) */
  keys?: Record<string, import('../../openchatcut/editor/clipTypes').Keyframe[]>;
}

export interface Keyframe {
  time: number;       // relative to clip's visible window (0 = first visible frame)
  property: 'opacity' | 'volume';
  value: number;
}

export interface Transition {
  id: string;
  type: 'dissolve' | 'fadeToBlack' | 'fadeFromBlack';
  duration: number;
  clipAId: string;
  clipBId?: string;   // undefined for fades (single-clip)
  /** [remix] OpenChatCut GLSL transition (replaces the plain dissolve in preview/export when set). */
  glType?: string;
  /** plugin transition snapshot, used when the pack is not installed */
  glDef?: import('../../openchatcut/gl/customTransitions').CustomTransitionDef;
  /** [remix] Stage 6: per-cut overrides of a vendored gl-transitions shader's uniforms (absent = defaults) */
  glParams?: Record<string, number | boolean | number[]>;
}

export interface TimelineMarker {
  id: string;
  time: number;
  color: string;
  label: string;
}

export interface Timeline {
  id: string;
  name: string;
  tracks: Track[];
  clips: Clip[];
  duration: number;
  transitions: Transition[];
  markers: TimelineMarker[];
  /** [remix] persistent multicam groups (OpenChatCut group + angle-decision concepts, see lib/occ/multicam-groups.ts) */
  multicam?: import('../lib/occ/multicam-groups').McGroup[];
  /** [remix] project frame ratio (absent = 16:9) and default picture fit (absent = contain); see lib/occ/frame-geometry.ts */
  aspect?: string;
  fit?: 'contain' | 'cover';
  /** [remix] Stage 4: master volume 0 to 1 (absent = 1). Preview master gain; export multiplies every clip volume. */
  masterVolume?: number;
}

/** Effective duration of a clip (what plays on the timeline). */
export function clipEffectiveDuration(clip: Clip): number {
  return (clip.duration - clip.trimStart - clip.trimEnd) / clip.speed;
}

/** End time of a clip on the timeline. */
export function clipEndTime(clip: Clip): number {
  return clip.startTime + clipEffectiveDuration(clip);
}

export interface EditorLayout {
  leftPanelWidth: number;
  leftPanelMode: 'full' | 'compact';
  viewerTimelineSplit: number;
  sourceTimelineSplit: number;
  sourceViewerVisible: boolean;
  rightPanelWidth: number;
  inspectorVisible: boolean;
}

export const DEFAULT_EDITOR_LAYOUT: EditorLayout = {
  leftPanelWidth: 240,
  leftPanelMode: 'full',
  viewerTimelineSplit: 0.42, // [remix] was 0.55: more room so the four default tracks show
  sourceTimelineSplit: 0.5,
  sourceViewerVisible: false,
  rightPanelWidth: 280,
  inspectorVisible: false,
};
