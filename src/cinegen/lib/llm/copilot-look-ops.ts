// [remix] Assistant access to the tools ported from OpenChatCut: effects, LUT looks, blend modes, zoom, GL transitions,
// and (async) scene splitting + captions. The assistant names things in plain words; this resolves them to catalog ids.
import { ALL_FX, FX_IDS, LUT_IDS } from '../../../openchatcut/gl/fx/effects';
import { ZOOM_SHAPE_ORDER, ZOOM_SHAPE_LABELS, type ZoomEffect, type ZoomShape } from '../../../openchatcut/editor/types';
import { CAPTION_STYLES } from '../../../openchatcut/captions/styles';
import type { CaptionMotionPreset, CaptionTemplate } from '../../../openchatcut/captions/types';
import { t } from '../../../openchatcut/i18n/t';
import { userLutIds } from '@cinegen/lib/occ/user-luts';
import { BLEND_MODES } from '@cinegen/lib/occ/blend';
import { GL_TRANSITION_ORDER, glTransitionLabel, addGlTransition, setGlType, removeTransition, nextClipOnTrack, transitionBetween, transitionHandle } from '@cinegen/lib/occ/transitions';
import { updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import type { Clip, ClipFx, Timeline } from '@cinegen/types/timeline';

export type LookOp =
  | { op: 'set_look'; clipId: string; effects?: Array<{ effect: string; props?: Record<string, number> }>; lut?: string | null; lutIntensity?: number; blendMode?: string | null; clear?: boolean }
  | { op: 'set_zoom'; clipId: string; shape?: string; magnification?: number; focalX?: number; focalY?: number; clear?: boolean }
  | { op: 'add_transition'; fromClipId: string; toClipId?: string; type: string; duration?: number }
  | { op: 'remove_transition'; fromClipId: string; toClipId?: string };

export const MOTIONS: CaptionMotionPreset[] = ['none', 'fade-up', 'pop', 'word-pop', 'karaoke-pulse'];
const norm = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/black and white|black white/g, 'b and w').replace(/[^a-z0-9]+/g, ' ').replace(/\b(and|the|a|look|looks|effect|transition)\b/g, ' ').replace(/\s+/g, ' ').trim();
const english = (id: string) => norm(t(ALL_FX[id]?.name ?? id));

function pick(ids: readonly string[], label: (id: string) => string, query: string): string | null {
  const q = norm(query);
  if (!q) return null;
  const tail = (id: string) => norm(id.replace(/^builtin:(fx-|look-|tr-)?/, '').replace(/^user:lut-/, ''));
  return ids.find((id) => id === query)
    ?? ids.find((id) => label(id).toLowerCase() === query.toLowerCase() || norm(label(id)) === q || tail(id) === q)
    ?? ids.find((id) => norm(label(id)).includes(q) || tail(id).includes(q) || q.includes(norm(label(id))))
    ?? null;
}
export const resolveEffect = (q: string) => pick(FX_IDS, english, q);
export const resolveLut = (q: string) => pick([...LUT_IDS, ...userLutIds()], english, q);
export const resolveTransition = (q: string) => pick(GL_TRANSITION_ORDER, glTransitionLabel, q);
export const resolveZoomShape = (q: string): ZoomShape | null => pick(ZOOM_SHAPE_ORDER, (id) => t(ZOOM_SHAPE_LABELS[id as ZoomShape]), q) as ZoomShape | null;
export const resolveCaptionTemplate = (q: string): CaptionTemplate | null => (CAPTION_STYLES.find((s) => s.id === q || norm(s.label) === norm(q) || norm(s.label).includes(norm(q)))?.id ?? null);
export const resolveBlend = (q: string) => BLEND_MODES.find((m) => norm(m) === norm(q)) ?? null;
export const resolveMotion = (q: string) => MOTIONS.find((m) => norm(m) === norm(q)) ?? null;

/** Names the model may use, for the actions guide. */
export function lookCatalogGuide(): string {
  return [
    `Effects (\`effect\`): ${FX_IDS.map((id) => english(id)).join(', ')}.`,
    `LUTs / looks (\`lut\`): ${LUT_IDS.map((id) => english(id)).join(', ')}.`,
    `Transitions (\`type\`): ${GL_TRANSITION_ORDER.map((id) => glTransitionLabel(id)).join(', ')}.`,
    `Zoom shapes (\`shape\`): ${ZOOM_SHAPE_ORDER.map((id) => t(ZOOM_SHAPE_LABELS[id])).join(', ')}.`,
    `Blend modes: ${BLEND_MODES.join(', ')}.`,
    `Caption templates: ${CAPTION_STYLES.map((s) => s.label).join(', ')}. Caption motion: ${MOTIONS.join(', ')}.`,
  ].join('\n');
}

const clipOf = (tl: Timeline, id: string): Clip | undefined => tl.clips.find((c) => c.id === id);

export function applyLookOp(tl: Timeline, op: LookOp): Timeline {
  if (op.op === 'set_look') {
    const clip = clipOf(tl, op.clipId); if (!clip) return tl;
    const updates: Partial<Pick<Clip, 'fx' | 'lut' | 'blendMode'>> = {};
    if (op.clear) { updates.fx = undefined; updates.lut = undefined; updates.blendMode = undefined; }
    if (op.effects) {
      const fx: ClipFx[] = op.clear ? [] : [...(clip.fx ?? [])];
      for (const e of op.effects) { const id = resolveEffect(e.effect); if (id) fx.push({ id, props: e.props ?? {} }); }
      updates.fx = fx.length ? fx : undefined;
    }
    if (op.lut === null) updates.lut = undefined;
    else if (typeof op.lut === 'string') { const id = resolveLut(op.lut); if (id) updates.lut = { id, intensity: Math.min(1, Math.max(0, op.lutIntensity ?? clip.lut?.intensity ?? 1)) }; }
    else if (op.lutIntensity !== undefined && clip.lut) updates.lut = { ...clip.lut, intensity: Math.min(1, Math.max(0, op.lutIntensity)) };
    if (op.blendMode === null) updates.blendMode = undefined;
    else if (typeof op.blendMode === 'string') { const m = resolveBlend(op.blendMode); updates.blendMode = m && m !== 'normal' ? m : undefined; }
    return updateClipProperties(tl, op.clipId, updates);
  }
  if (op.op === 'set_zoom') {
    const clip = clipOf(tl, op.clipId); if (!clip) return tl;
    if (op.clear) return updateClipProperties(tl, op.clipId, { zoom: undefined });
    const shape = op.shape ? resolveZoomShape(op.shape) : null;
    const zoom: ZoomEffect = { shape: 'hold', magnification: 1.5, ...(clip.zoom ?? {}), ...(shape ? { shape, reframeCurve: undefined } : {}) };
    if (op.magnification !== undefined) zoom.magnification = Math.min(16, Math.max(1, op.magnification));
    if (op.focalX !== undefined) zoom.focalPointX = Math.min(1, Math.max(0, op.focalX));
    if (op.focalY !== undefined) zoom.focalPointY = Math.min(1, Math.max(0, op.focalY));
    return updateClipProperties(tl, op.clipId, { zoom });
  }
  if (op.op === 'add_transition') {
    const a = clipOf(tl, op.fromClipId); if (!a) return tl;
    const b = op.toClipId ? clipOf(tl, op.toClipId) : nextClipOnTrack(tl, a); if (!b) return tl;
    const glType = resolveTransition(op.type); if (!glType) return tl;
    const existing = transitionBetween(tl, a, b);
    if (existing) return setGlType(tl, existing.id, glType);
    const handle = transitionHandle(a, b); if (handle <= 0.05) return tl;
    return addGlTransition(tl, a, b, glType, Math.min(op.duration ?? 0.5, handle));
  }
  const a = clipOf(tl, op.fromClipId); if (!a) return tl;
  const b = op.toClipId ? clipOf(tl, op.toClipId) : nextClipOnTrack(tl, a); if (!b) return tl;
  const existing = transitionBetween(tl, a, b);
  return existing ? removeTransition(tl, existing.id) : tl;
}
