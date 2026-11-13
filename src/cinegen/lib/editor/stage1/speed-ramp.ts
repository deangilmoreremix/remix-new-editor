// [remix] Stage 1: speed ramp (pure). The preview engine and the Remotion export both play a clip at ONE constant speed, so a ramp is
// realised as a stepped ramp: the clip is cut into N pieces over its source range and each piece gets the ramp's speed at its middle.
// Everything downstream (preview, export, undo, save) sees ordinary clips. Keyframes follow their source position; the clip's fade-in stays
// on the first piece and its fade-out on the last. Linked clips (the audio of a video) are ramped identically. Later clips ripple.
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { clipEffectiveDuration, clipEndTime } from '@cinegen/types/timeline';
import { generateId } from '@cinegen/lib/utils/ids';
import { calculateTimelineDuration } from '../timeline-operations';

export const RAMP_MIN_SPEED = 0.1;
export const RAMP_MAX_SPEED = 8;
export const DEFAULT_RAMP_STEPS = 8;
const EPS = 1e-6;

/** at = position in the clip's source range, 0 (start) .. 1 (end) */
export interface RampPoint { at: number; speed: number }

export const RAMP_PRESETS: Record<string, { label: string; points: RampPoint[] }> = {
  'speed-up': { label: 'Speed up (1x to 4x)', points: [{ at: 0, speed: 1 }, { at: 1, speed: 4 }] },
  'slow-down': { label: 'Slow down (1x to 0.25x)', points: [{ at: 0, speed: 1 }, { at: 1, speed: 0.25 }] },
  'slow-dip': { label: 'Slow dip (1x, 0.25x, 1x)', points: [{ at: 0, speed: 1 }, { at: 0.5, speed: 0.25 }, { at: 1, speed: 1 }] },
  'burst': { label: 'Burst (0.5x, 3x, 0.5x)', points: [{ at: 0, speed: 0.5 }, { at: 0.5, speed: 3 }, { at: 1, speed: 0.5 }] },
};

const clampSpeed = (s: number) => Math.max(RAMP_MIN_SPEED, Math.min(RAMP_MAX_SPEED, s));

/** Linear speed at `at` (0..1) between the points; flat before the first and after the last. */
export function speedAt(points: RampPoint[], at: number): number {
  const p = [...points].filter((x) => Number.isFinite(x.at) && Number.isFinite(x.speed)).sort((a, b) => a.at - b.at);
  if (!p.length) return 1;
  if (at <= p[0].at) return clampSpeed(p[0].speed);
  if (at >= p[p.length - 1].at) return clampSpeed(p[p.length - 1].speed);
  for (let i = 0; i < p.length - 1; i++) {
    if (at >= p[i].at && at <= p[i + 1].at) {
      const f = p[i + 1].at === p[i].at ? 0 : (at - p[i].at) / (p[i + 1].at - p[i].at);
      return clampSpeed(p[i].speed + f * (p[i + 1].speed - p[i].speed));
    }
  }
  return 1;
}

/** One speed per piece: the ramp evaluated at each piece's middle. */
export const rampSpeeds = (points: RampPoint[], steps = DEFAULT_RAMP_STEPS): number[] =>
  Array.from({ length: steps }, (_, i) => Math.round(speedAt(points, (i + 0.5) / steps) * 1000) / 1000);

function pieces(clip: Clip, speeds: number[]): Clip[] {
  const n = speeds.length;
  const S = clip.duration - clip.trimStart - clip.trimEnd; // visible source span
  let acc = clip.startTime;
  return speeds.map((sp, i) => {
    const a = (S * i) / n; const b = (S * (i + 1)) / n;
    const kf = clip.keyframes
      .filter((k) => { const u = k.time * clip.speed; return u >= a - EPS && (i === n - 1 ? true : u < b - EPS); })
      .map((k) => ({ ...k, time: Math.max(0, (k.time * clip.speed - a) / sp) }));
    const piece: Clip = { ...clip, id: i === 0 ? clip.id : generateId(), startTime: acc, trimStart: clip.trimStart + a, trimEnd: clip.trimEnd + (S - b), speed: sp, keyframes: kf, linkedClipIds: undefined };
    if (i > 0) delete piece.fadeIn;
    if (i < n - 1) delete piece.fadeOut;
    acc += (b - a) / sp;
    return piece;
  });
}

export interface RampResult { timeline: Timeline; clipIds: string[] }

/** Replace the clip (and its linked clips) by a stepped speed ramp. Clips after it on the same tracks ripple by the length change. */
export function applySpeedRamp(timeline: Timeline, clipId: string, points: RampPoint[], opts: { steps?: number; ripple?: boolean } = {}): RampResult {
  const clip = timeline.clips.find((c) => c.id === clipId);
  if (!clip || !points.length || clip.compound) return { timeline, clipIds: [] };
  const steps = Math.max(2, Math.min(32, Math.round(opts.steps ?? DEFAULT_RAMP_STEPS)));
  const speeds = rampSpeeds(points, steps);
  const group = [clip, ...(clip.linkedClipIds ?? []).map((id) => timeline.clips.find((c) => c.id === id)).filter((c): c is Clip => !!c)];
  const groupIds = new Set(group.map((c) => c.id));
  const made = new Map<string, Clip[]>(group.map((c) => [c.id, pieces(c, speeds)]));
  // links between the pieces: piece i of a clip <-> piece i of its partners; links to clips outside the ramp are kept
  for (const c of group) {
    const mine = made.get(c.id) as Clip[];
    mine.forEach((pc, i) => {
      const ext = (c.linkedClipIds ?? []).filter((l) => !groupIds.has(l));
      const partners = group.filter((g) => g.id !== c.id && (c.linkedClipIds ?? []).includes(g.id)).map((g) => (made.get(g.id) as Clip[])[i].id);
      const all = [...partners, ...ext];
      pc.linkedClipIds = all.length ? all : undefined;
    });
  }
  const lastId = new Map(group.map((c) => [c.id, (made.get(c.id) as Clip[]).at(-1)?.id as string]));
  const oldEnd = new Map(group.map((c) => [c.id, clipEndTime(c)]));
  const delta = new Map(group.map((c) => [c.id, (made.get(c.id) as Clip[]).reduce((m, p) => m + clipEffectiveDuration(p), 0) - clipEffectiveDuration(c)]));

  let clips = timeline.clips.flatMap((c) => (groupIds.has(c.id) ? (made.get(c.id) as Clip[]) : [c]));
  if (opts.ripple !== false) {
    clips = clips.map((c) => {
      if (made.has(c.id) || [...made.values()].some((arr) => arr.some((p) => p.id === c.id))) return c;
      for (const g of group) {
        if (c.trackId === g.trackId && c.startTime >= (oldEnd.get(g.id) as number) - EPS) return { ...c, startTime: Math.max(0, c.startTime + (delta.get(g.id) as number)) };
      }
      return c;
    });
  }
  const transitions = (timeline.transitions ?? []).map((t) => {
    // the outgoing side of a transition now sits on the last piece
    if (groupIds.has(t.clipAId) && (t.type === 'fadeToBlack' || t.clipBId)) return { ...t, clipAId: lastId.get(t.clipAId) as string };
    return t;
  });
  const out = { ...timeline, clips, transitions };
  return { timeline: { ...out, duration: calculateTimelineDuration(out) }, clipIds: (made.get(clipId) as Clip[]).map((c) => c.id) };
}
