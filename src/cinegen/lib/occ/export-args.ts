// [remix] The arguments the CineGen export (`electronAPI.export.start`) needs, built from a timeline + its assets + its overlay lane.
// One mapper for the Export tab (the user's project) and the Template Generator (a template rendered on its own), so both render the same way.
import { resolveFit } from '@cinegen/lib/occ/frame-geometry';
import { clipEffectiveDuration, clipEndTime, type Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import type { OverlayClip } from '@cinegen/types/workspace';
import type { ExportPreset } from '@cinegen/types/export';

/** A site-relative file (the bundled music) must be a full address: the export runs in a sandboxed frame with no origin of its own. */
const absolute = (p: string) => (p.startsWith('/') && !p.startsWith('//') && typeof location !== 'undefined' ? `${location.origin}${p}` : p);

export function exportClipsOf(timeline: Timeline, assets: Asset[]) {
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));
  return timeline.clips.flatMap((clip) => {
    const asset = assetsById.get(clip.assetId);
    const inputPath = asset?.fileRef || asset?.url;
    const duration = clipEffectiveDuration(clip);
    if (!asset || !inputPath || duration <= 0) return [];
    return [{
      id: clip.id,
      inputPath: absolute(inputPath),
      startTime: clip.startTime,
      duration,
      trimStart: clip.trimStart,
      speed: clip.speed || 1,
      volume: clip.volume ?? 1,
      type: asset.type,
      // a clip on an audio track plays sound only, even when its media file is a video
      trackKind: timeline.tracks.find((t) => t.id === clip.trackId)?.kind,
      // OpenChatCut effects burned into the render
      fadeIn: clip.fadeIn, fadeOut: clip.fadeOut, kf: clip.keyframes, transform: clip.transform, fit: resolveFit(clip, timeline), fx: clip.fx, lut: clip.lut, blendMode: clip.blendMode, zoom: clip.zoom, captions: clip.captions,
    }];
  });
}

export const exportTotalDuration = (timeline: Timeline) => Math.max(timeline.duration, ...timeline.clips.map(clipEndTime));

/** GL transitions on dissolve cuts. */
export const exportTransitionsOf = (timeline: Timeline) => (timeline.transitions ?? [])
  .filter((t) => t.glType && t.type === 'dissolve' && t.clipBId)
  .map((t) => ({ glType: t.glType, glDef: t.glDef, clipAId: t.clipAId, clipBId: t.clipBId }));

/** The overlay lane, split by how each kind is rendered: drawn overlays, motion-graphics code, HyperFrames blocks. */
export function exportOverlaysOf(overlays: OverlayClip[] = []) {
  return {
    overlays: overlays.filter((o) => o.type !== 'mg-template' && o.type !== 'hyperframes'),
    mgOverlays: overlays.filter((o) => o.type === 'mg-template').map((o) => ({ id: o.id, name: o.name, start: o.start, end: o.end, code: o.code, props: o.props })),
    hfOverlays: overlays.filter((o) => o.type === 'hyperframes').map((o) => ({ id: o.id, name: o.name, start: o.start, end: o.end, blockId: o.blockId, props: o.props, blockWidth: o.blockWidth, blockHeight: o.blockHeight })),
  };
}

/** Everything `export.start` takes for a whole timeline. */
export function buildExportArgs(timeline: Timeline, assets: Asset[], overlays: OverlayClip[], opts: { preset?: ExportPreset; fps?: 24 | 30 | 60; videoBitrate?: number; qa?: boolean; aspect?: string } = {}) {
  return {
    preset: opts.preset ?? 'standard',
    fps: opts.fps ?? 30,
    clips: exportClipsOf(timeline, assets),
    totalDuration: exportTotalDuration(timeline),
    videoBitrate: opts.videoBitrate, qa: opts.qa, aspect: opts.aspect,
    ...exportOverlaysOf(overlays),
    transitions: exportTransitionsOf(timeline),
  };
}
