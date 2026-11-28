// [remix] The model the editor preview draws for Studio Design clips: only those clips, with the previewed contact's details filled in,
// built by the same timelineToComposition the published video and the MP4 export use, so the preview matches them.
// @ts-expect-error plain JS composition builder
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';

export const STUDIO_DESIGN_TYPE = 'overlay-studio-design';
export const FPS = 30;

type Design = { id: string; type: string; start: number; end: number } & Record<string, unknown>;

export function hasStudioDesign(overlays: Array<{ type: string }>): boolean {
  return overlays.some((o) => o.type === STUDIO_DESIGN_TYPE);
}

/** Composition model for the Studio Design overlays alone (null when there are none). */
export function studioDesignModel(overlays: Design[], profile: Record<string, unknown> | null, timelineSeconds: number, aspect = '16:9') {
  const items = overlays.filter((o) => o.type === STUDIO_DESIGN_TYPE);
  if (!items.length) return null;
  const state = { timelineSeconds: Math.max(1, timelineSeconds || 60), tracks: [{ id: 'ov', type: 'text', items }] };
  const model = timelineToComposition(state, { fps: FPS, quality: '720p', aspect, ...(profile ? { profile } : {}) }) as { width: number; height: number; durationInFrames: number; layers: unknown[]; background?: string };
  // The composition paints black by default; here it sits over the video, so it must be see-through.
  return { ...model, background: 'transparent' };
}
