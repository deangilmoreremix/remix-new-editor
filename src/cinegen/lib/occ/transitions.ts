// [remix] Hosts OpenChatCut's GL transitions on CineGen's dissolve transition (clip A overlaps clip B).
import { addTransition, removeTransition } from '@cinegen/lib/editor/timeline-operations';
import { clipEffectiveDuration, clipEndTime, type Clip, type Timeline, type Transition } from '@cinegen/types/timeline';
import { GLSL_TRANSITIONS } from '../../../openchatcut/gl/transitions';
import { t } from '../../../openchatcut/i18n/t';
import { isKnownTransition, transitionSnapshotFor } from './plugins';

/** Their transition catalog order (editor/transitionTypes.ts TRANSITION_ORDER). */
export const GL_TRANSITION_ORDER = ['anticipation-zoom', 'clean-line-wipe', 'cross-dissolve', 'dip-to-black', 'flash', 'impact-shake', 'luma-blend', 'organic-dissolve', 'page-curl', 'rack-focus', 'soft-wipe', 'whip-pan', 'circle-wipe', 'radial-blur', 'glitch-cut', 'dip-to-color'] as const;
const ZH: Record<string, string> = { 'anticipation-zoom': '推进转场', 'clean-line-wipe': '白色划线转场', 'cross-dissolve': '叠化转场', 'dip-to-black': '闪黑转场', flash: '闪白转场', 'impact-shake': '冲击抖动转场', 'luma-blend': '叠加转场', 'organic-dissolve': '光溶转场', 'page-curl': '翻页转场', 'rack-focus': '焦点转场', 'soft-wipe': '柔化擦除转场', 'whip-pan': '甩镜转场', 'circle-wipe': '圆形擦除转场', 'radial-blur': '径向模糊转场', 'glitch-cut': '故障切换转场', 'dip-to-color': '闪色转场' };
export const glTransitionLabel = (id: string) => t(ZH[id] ?? id);
export const isGlTransition = (id?: string, snap?: Transition['glDef']): id is string => isKnownTransition(id, snap);

/** The clip that follows `clip` on its track (the cut a transition would sit on). */
export function nextClipOnTrack(tl: Timeline, clip: Clip): Clip | null {
  return tl.clips.filter((c) => c.trackId === clip.trackId && c.id !== clip.id && c.startTime >= clip.startTime - 1e-6)
    .sort((a, b) => a.startTime - b.startTime)[0] ?? null;
}
export const transitionBetween = (tl: Timeline, a: Clip, b: Clip): Transition | undefined =>
  (tl.transitions ?? []).find((x) => x.clipAId === a.id && x.clipBId === b.id);

/** Spare source material available for an overlap (CineGen needs trim handles on both sides). */
export const transitionHandle = (a: Clip, b: Clip) => Math.min(a.trimEnd, b.trimStart);

export function addGlTransition(tl: Timeline, a: Clip, b: Clip, glType: string, duration: number, glDef?: Transition['glDef']): Timeline {
  const next = addTransition(tl, { id: `tr-${a.id}-${b.id}`, type: 'dissolve', duration, clipAId: a.id, clipBId: b.id, glType, ...(glDef ? { glDef } : {}) });
  return next;
}
export const setGlType = (tl: Timeline, id: string, glType: string | undefined, glDef?: Transition['glDef']): Timeline =>
  ({ ...tl, transitions: (tl.transitions ?? []).map((x) => (x.id === id ? { ...x, glType, glDef } : x)) });
export { transitionSnapshotFor };
export { removeTransition };

/** Active GL transition at `time`: both clips, eased progress 0..1 across the overlap. */
export function activeGlTransition(tl: Timeline, time: number) {
  for (const tr of tl.transitions ?? []) {
    if (!isGlTransition(tr.glType, tr.glDef) || tr.type !== 'dissolve' || !tr.clipBId) continue;
    const a = tl.clips.find((c) => c.id === tr.clipAId); const b = tl.clips.find((c) => c.id === tr.clipBId);
    if (!a || !b) continue;
    const start = b.startTime; const end = clipEndTime(a);
    if (end - start <= 1e-6 || time < start || time >= end) continue;
    return { glType: tr.glType, glDef: tr.glDef, outClipId: a.id, inClipId: b.id, progress: (time - start) / (end - start) };
  }
  return null;
}
export { clipEffectiveDuration };
