// [remix] Stage 6: the export hand-off for GL transitions (built-in, plugin and vendored gl-transitions), as a pure function so it is
// testable. One layer per cut: window = clip B's start -> clip A's end, rendered by GlTransitionLayer over both clips and burned into the MP4.
import { customTransitionDefSync } from '@cinegen/lib/occ/plugins';
import type { ExportTransitionInfo } from './export-mapping';

export interface GlExportClip { id?: string; inputPath: string; startTime: number; duration: number; trimStart: number; speed: number }
export interface GlTransitionLayerSpec {
  id: string; glType: string; customDef: unknown; glParams?: Record<string, number | boolean | number[]>; from: number; durationInFrames: number;
  out: { src: string; trimBefore: number; playbackRate: number }; inn: { src: string; trimBefore: number; playbackRate: number };
}

export function buildGlTransitionLayers(transitions: ExportTransitionInfo[] | undefined, clips: GlExportClip[], fps: number): GlTransitionLayerSpec[] {
  const byId = new Map(clips.map((c) => [c.id, c]));
  return (transitions ?? []).flatMap((t) => {
    const A = byId.get(t.clipAId); const B = t.clipBId ? byId.get(t.clipBId) : undefined;
    if (!t.glType || !A || !B) return [];
    const start = B.startTime; const end = A.startTime + A.duration;
    const from = Math.round(start * fps); const dur = Math.round((end - start) * fps);
    if (dur < 2) return [];
    const rate = (c: GlExportClip) => c.speed || 1;
    return [{
      id: `gl-${t.clipAId}-${t.clipBId}`, glType: t.glType, customDef: t.glDef ?? customTransitionDefSync(t.glType), ...(t.glParams ? { glParams: t.glParams } : {}), from, durationInFrames: dur,
      out: { src: A.inputPath, trimBefore: Math.round((A.trimStart + (start - A.startTime) * rate(A)) * fps), playbackRate: rate(A) },
      inn: { src: B.inputPath, trimBefore: Math.round(B.trimStart * fps), playbackRate: rate(B) },
    }];
  });
}
