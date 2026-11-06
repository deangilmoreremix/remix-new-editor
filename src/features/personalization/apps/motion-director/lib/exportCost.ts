import { EXPORT_MS_PER_FRAME } from '../demosrc/_generated/exportCost';
import type { ProjectData } from '../types';

/**
 * What a recipe costs the web renderer. The renderer walks the page for every frame, so a
 * recipe's cost follows how many elements, filters and shadows it draws; the table is the
 * measured time per frame (1080p, one headless Chromium core, `scripts/motion-export-bench.mjs`)
 * and is only a ranking: a real machine is faster, but slow recipes stay slow.
 */
export const SLOW_MS_PER_FRAME = 450;
/** Frames of a recipe the benchmark could not measure, and of every non-recipe card. */
const DEFAULT_MS_PER_FRAME = 150;

export const msPerFrame = (componentName: string): number => EXPORT_MS_PER_FRAME[componentName] ?? DEFAULT_MS_PER_FRAME;

export const isSlowToExport = (componentName: string): boolean => msPerFrame(componentName) >= SLOW_MS_PER_FRAME;

/** Seconds the benchmark machine would need for the whole film: layers draw together, so each frame costs the sum of what is on screen. */
export function estimateExportSec(project: ProjectData): number {
  const cost: number[] = [];
  for (const track of project.tracks) {
    if (track.hidden) continue;
    for (const clip of track.clips) {
      if (clip.cardId.startsWith('audio') || clip.cardId === 'audio-clip') continue;
      const per = clip.cardId.startsWith('demo:') ? msPerFrame(clip.cardId.slice(5)) : 20;
      const from = Math.max(0, Math.round(clip.start));
      const to = Math.round(clip.start + clip.duration);
      for (let f = from; f < to; f++) cost[f] = (cost[f] ?? 0) + per;
    }
  }
  const total = cost.reduce((sum, v) => sum + (v ?? 0), 0);
  return Math.round(total / 1000);
}
