// [remix] Types from OpenChatCut editor/clipTypes.ts needed by the vendored zoom + tracking code.
/** one sparse reframe keyframe (ReframeCurveV1: named scalar channels) */
export interface ReframeKeyframe {
  /** effect-local frame */
  frame: number;
  /** 0..1 composition-normalized focal point */
  focalPointX: number;
  focalPointY: number;
  /** zoom magnification at this keyframe (0.05..16) */
  magnification: number;
}

/** ReframeCurveV1 — the sparse-keyframe model for zoom (focal/mag) */
export interface ReframeCurveV1 {
  version: 1;
  timebase: 'effect-frame';
  coordinateSpace: 'composition-normalized';
  keyframes: ReframeKeyframe[];
}

/** builtin:zoom — parametric animated zoom (shape curve) or a reframe curve */
export type ZoomShape =
  | 'hold' | 'punch' | 'slow-push' | 'instant' | 'zoom-out' | 'ease-in' | 'bounce'
  | 'snap' | 'pulse' | 'whip-in';
// zh labels: 4 base curves + extended library curves
export const ZOOM_SHAPE_LABELS: Record<ZoomShape, string> = {
  punch: '冲击',
  hold: '推进拉回',
  'slow-push': '慢推',
  instant: '瞬时',
  'zoom-out': '拉远',
  'ease-in': '缓入推近',
  bounce: '弹性推近',
  snap: '快切推近',
  pulse: '心跳脉冲',
  'whip-in': '甩入推近',
};
/** library display order */
export const ZOOM_SHAPE_ORDER: readonly ZoomShape[] = [
  'punch', 'hold', 'slow-push', 'instant', 'zoom-out', 'ease-in', 'bounce',
  'snap', 'pulse', 'whip-in',
];
export interface ZoomEffect {
  /** peak magnification (1..16, default 1.5) */
  magnification?: number;
  /** 0..1 focal point the zoom pushes toward */
  focalPointX?: number;
  focalPointY?: number;
  shape?: ZoomShape;
  easeInFrames?: number;
  easeOutFrames?: number;
  /** sparse keyframes (__openchatcutReframeCurve); overrides the shape curve */
  reframeCurve?: ReframeCurveV1;
  /** Plugin scaling curve: 0..1 (can reach 1.5 overshoot) envelope, linear sampling of the entire clip.
   * Priority: reframeCurve > envelope > shape. */
  envelope?: number[];
  /** Plugin curve display name (script/inspector); used when there is no shape */
  label?: string;
}


/** [remix] The few TimelineItem fields their tracking/zoom code reads. */
export interface TimelineItem { id: string; name?: string; src?: string; srcInFrame?: number; playbackRate?: number; width?: number; height?: number; durationInFrames: number; zoom?: ZoomEffect }
