// Core timeline domain types — ported shape from timeline-studio `timeline/types`
// Re-implemented here (we do not have upstream source access) following the
// documented feature contract.

export type TrackKind = 'video' | 'audio' | 'subtitle';

export type ClipKind = 'video' | 'audio' | 'subtitle' | 'image';

export interface BaseClip {
  id: string;
  trackId: string;
  /** start position on the timeline, in seconds */
  start: number;
  /** clip duration on the timeline, in seconds */
  duration: number;
  /** in-point into the source media, in seconds */
  inPoint: number;
  /** out-point into the source media, in seconds */
  outPoint: number;
  name: string;
  kind: ClipKind;
  /** pixel offset of the clip's left edge on its track (derived) */
  linkedClipId?: string;
  color?: string;
  effects?: ClipEffect[];
  keyframes?: Keyframe[];
  speedRamp?: SpeedRampPoint[];
  transitionIds?: string[];
  muted?: boolean;
  locked?: boolean;
}

export interface VideoClip extends BaseClip {
  kind: 'video' | 'image';
  mediaId: string;
  thumbnailUrl?: string;
}

export interface AudioClip extends BaseClip {
  kind: 'audio';
  mediaId: string;
  waveformUrl?: string;
}

export interface SubtitleClip extends BaseClip {
  kind: 'subtitle';
  text: string;
  language?: string;
}

export type Clip = VideoClip | AudioClip | SubtitleClip;

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  height: number;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  solo: boolean;
}

export interface Keyframe {
  id: string;
  clipId: string;
  property: string;
  time: number;
  value: number;
  easing: 'linear' | 'bezier' | 'hold';
}

export interface SpeedRampPoint {
  id: string;
  time: number;
  /** multiplier, 1 = normal speed */
  rate: number;
}

export type TransitionKind = 'fade' | 'dissolve' | 'slide' | 'wipe';

export interface Transition {
  id: string;
  kind: TransitionKind;
  clipIds: string[];
  duration: number;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
  kind: 'standard' | 'j' | 'l';
}

export interface ClipGroup {
  id: string;
  clipIds: string[];
}

export type EditMode = 'default' | 'slip' | 'slide' | 'trim';

export interface TimelineState {
  tracks: Track[];
  clips: Clip[];
  transitions: Transition[];
  markers: Marker[];
  groups: ClipGroup[];
  duration: number;
  currentTime: number;
  zoom: number; // pixels per second
  editMode: EditMode;
  selectedClipIds: string[];
  selectedTrackIds: string[];
  playing: boolean;
  snapEnabled: boolean;
}

export interface ClipEffect {
  id: string;
  type: string;
  params: Record<string, number | string>;
}

export const SNAP_THRESHOLD_PX = 8;
