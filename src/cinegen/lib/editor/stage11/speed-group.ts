// [remix] Fix M: re-editable speed curves (pure). A speed curve is realised as N consecutive clips (pieces, see speed-curve.ts) and the curve itself used to be
// thrown away. Every piece now carries `clip.speedCurve` (group id, piece index, the curve, the step count, the ORIGINAL source span, and on piece 0 the original
// clip's speed / anim), which round-trips through the stage1_json column like groupId / anim do (db-converters.ts; absent on old projects, nothing stripped).
//
// Re-edit rule (the choice for edge cases): a group can be re-edited only while it is INTACT, i.e. for every track of the group the pieces are still all there,
// contiguous in time, on their track, with exactly the trims and constant speeds the curve produced, and no transition sits between two pieces, and the
// tracks are not locked. The check recomputes the expected pieces from the stored curve, so any split, trim, move, retime, delete, duplicate or paste makes the
// group STALE. A stale group is never silently guessed at: `inspectSpeedGroup` returns the reason (shown to the user) and the UI then offers a fresh curve over
// the selected piece only (the old behaviour). Properties other than timing (fx, volume, eq, ...) are taken from piece 0 on re-apply, like the first apply copies them
// from the one original clip; keyframes (rebuilt from all pieces in source time) and fades (piece 0 in, last piece out) follow the pieces; the clip's `anim`
// comes from the snapshot on piece 0 (slicing it is lossy). Compound clips are never ramped (applySpeedRamp), and pieces nested inside a compound are not in
// the top-level clip list, so they cannot be re-edited until the compound is expanded.
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { clipEndTime } from '@cinegen/types/timeline';
import { generateId } from '@cinegen/lib/utils/ids';
import type { ClipAnim } from '../stage2/anim';
import { normalizeAnim } from '../stage2/anim';
import type { RampResult } from '../stage1/speed-ramp';
import { applySpeedCurve, curvePieceSpeeds, normalizeCurve, type SpeedCurve } from './speed-curve';
import { calculateTimelineDuration } from '../timeline-operations';

export interface ClipSpeedCurve {
  v: 1;
  /** one id per apply; the video and audio chains of one apply share it */
  group: string;
  /** piece index within its chain, 0-based */
  index: number;
  /** number of pieces in the chain */
  steps: number;
  curve: SpeedCurve;
  /** trims of the ORIGINAL clip (the source span the curve covers) */
  trimStart: number;
  trimEnd: number;
  /** piece 0 only: what the original clip had that cannot be rebuilt from the pieces */
  origin?: { speed: number; anim?: ClipAnim };
}

const EPS = 1e-6;
const TIME_TOL = 1e-4;

/** Validate an untrusted value (saved JSON). Undefined when it is not usable. */
export function normalizeClipSpeedCurve(raw: unknown): ClipSpeedCurve | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Partial<ClipSpeedCurve>;
  if (typeof r.group !== 'string' || !r.group) return undefined;
  if (!Number.isInteger(r.index) || (r.index as number) < 0) return undefined;
  if (!Number.isInteger(r.steps) || (r.steps as number) < 2) return undefined;
  if (!Number.isFinite(r.trimStart) || !Number.isFinite(r.trimEnd)) return undefined;
  if (!r.curve || !Array.isArray(r.curve.points)) return undefined;
  const origin = r.origin && typeof r.origin === 'object' && Number.isFinite(r.origin.speed) && (r.origin.speed as number) > 0
    ? { speed: r.origin.speed as number, ...(normalizeAnim(r.origin.anim) ? { anim: normalizeAnim(r.origin.anim) } : {}) }
    : undefined;
  return { v: 1, group: r.group, index: r.index as number, steps: r.steps as number, curve: normalizeCurve(r.curve), trimStart: r.trimStart as number, trimEnd: r.trimEnd as number, ...(origin ? { origin } : {}) };
}

export interface SpeedGroupChain { /** id of the original clip (= id of piece 0) */ origId: string; trackId: string; pieces: Clip[] }
export type SpeedGroupInspection =
  | { ok: true; group: string; curve: SpeedCurve; steps: number; /** visible source seconds the curve covers */ sourceSeconds: number; chains: SpeedGroupChain[]; target: SpeedGroupChain }
  | { ok: false; reason: string; /** false when the clip has no curve info at all (nothing to explain) */ hadInfo: boolean };

const stale = (reason: string): SpeedGroupInspection => ({ ok: false, reason, hadInfo: true });

/** Is the clip a piece of a speed curve whose group is still intact (so the curve can be re-opened)? */
export function inspectSpeedGroup(timeline: Timeline, clipId: string): SpeedGroupInspection {
  const clip = timeline.clips.find((c) => c.id === clipId);
  const info = normalizeClipSpeedCurve(clip?.speedCurve);
  if (!clip || !info) return { ok: false, reason: 'This clip was not made by a speed curve.', hadInfo: false };
  const label = 'This speed curve can no longer be edited';
  const same = (a: ClipSpeedCurve, b: ClipSpeedCurve) => a.steps === b.steps && Math.abs(a.trimStart - b.trimStart) < EPS && Math.abs(a.trimEnd - b.trimEnd) < EPS && JSON.stringify(a.curve) === JSON.stringify(b.curve);

  const chainOf = (trackId: string): Clip[] => timeline.clips.filter((c) => c.trackId === trackId && c.speedCurve?.group === info.group).sort((a, b) => (a.speedCurve?.index ?? 0) - (b.speedCurve?.index ?? 0));
  const targetPieces = chainOf(clip.trackId);
  // the other chains of the apply: the clips linked to the target's pieces that carry the same group id, one chain per track
  const partnerTracks = new Set<string>();
  for (const p of targetPieces) for (const l of p.linkedClipIds ?? []) { const o = timeline.clips.find((c) => c.id === l); if (o && o.speedCurve?.group === info.group && o.trackId !== clip.trackId) partnerTracks.add(o.trackId); }
  const chains: SpeedGroupChain[] = [];
  const speeds = curvePieceSpeeds(info.curve, info.steps);
  for (const [trackId, pieces] of [[clip.trackId, targetPieces] as const, ...[...partnerTracks].map((t) => [t, chainOf(t)] as const)]) {
    const track = timeline.tracks.find((t) => t.id === trackId);
    if (!track) return stale(`${label}: its track is gone.`);
    if (track.locked) return stale(`Track ${track.name} is locked. Unlock it to edit the speed curve.`);
    if (pieces.length !== info.steps) return stale(`${label}: its ${info.steps} pieces were split, deleted or duplicated (${pieces.length} found on ${track.name}).`);
    const infos = pieces.map((p) => normalizeClipSpeedCurve(p.speedCurve));
    if (infos.some((x, i) => !x || x.index !== i || !same(x, info))) return stale(`${label}: its pieces were changed or duplicated.`);
    if (!infos[0]?.origin) return stale(`${label}: the original clip data is missing.`);
    if (speeds.length !== info.steps) return stale(`${label}: the step count is not supported by this version.`);
    const S = pieces[0].duration - info.trimStart - info.trimEnd;
    if (!(S > 0)) return stale(`${label}: the source clip changed.`);
    let t = pieces[0].startTime;
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i]; const a = (S * i) / info.steps; const b = (S * (i + 1)) / info.steps;
      const ok = Math.abs(p.speed - speeds[i]) < EPS && Math.abs(p.trimStart - (info.trimStart + a)) < TIME_TOL && Math.abs(p.trimEnd - (info.trimEnd + S - b)) < TIME_TOL
        && Math.abs(p.startTime - t) < TIME_TOL && p.assetId === pieces[0].assetId && !p.compound;
      if (!ok) return stale(`${label}: piece ${i + 1} was moved, trimmed or retimed.`);
      t += (b - a) / speeds[i];
    }
    chains.push({ origId: pieces[0].id, trackId, pieces });
  }
  // a transition between two pieces would be lost on re-apply
  const inner = new Set<string>(); const first = new Set<string>(); const last = new Set<string>();
  for (const ch of chains) { ch.pieces.forEach((p, i) => { if (i > 0) inner.add(p.id); if (i === 0) first.add(p.id); if (i === ch.pieces.length - 1) last.add(p.id); }); }
  for (const tr of timeline.transitions ?? []) {
    if ((inner.has(tr.clipAId) && !last.has(tr.clipAId)) || (tr.clipBId && inner.has(tr.clipBId))) return stale(`${label}: a transition sits between its pieces.`);
  }
  const target = chains.find((c) => c.trackId === clip.trackId) as SpeedGroupChain;
  return { ok: true, group: info.group, curve: info.curve, steps: info.steps, sourceSeconds: targetPieces[0].duration - info.trimStart - info.trimEnd, chains, target };
}

const stampInfo = (curve: SpeedCurve, steps: number, group: string, orig: Clip, index: number): ClipSpeedCurve => ({
  v: 1, group, index, steps, curve, trimStart: orig.trimStart, trimEnd: orig.trimEnd,
  ...(index === 0 ? { origin: { speed: orig.speed, ...(orig.anim ? { anim: orig.anim } : {}) } } : {}),
});

/** Apply a speed curve to a clip (and its linked clips) and remember the curve on every piece. Same ripple / link behaviour as applySpeedCurve. */
export function applySpeedCurveGroup(timeline: Timeline, clipId: string, curve: SpeedCurve, opts: { steps?: number; ripple?: boolean } = {}): RampResult {
  const c = normalizeCurve(curve);
  const r = applySpeedCurve(timeline, clipId, c, opts);
  if (!r.chains) return r;
  const group = generateId();
  const speeds = curvePieceSpeeds(c, opts.steps);
  const byId = new Map<string, ClipSpeedCurve>();
  for (const [origId, ids] of Object.entries(r.chains)) {
    const orig = timeline.clips.find((x) => x.id === origId) as Clip;
    ids.forEach((id, i) => byId.set(id, stampInfo(c, speeds.length, group, orig, i)));
  }
  return { ...r, timeline: { ...r.timeline, clips: r.timeline.clips.map((x) => (byId.has(x.id) ? { ...x, speedCurve: byId.get(x.id) } : x)) } };
}

/** Rebuild the original clip of a chain from its (intact) pieces, so applySpeedRamp can cut it again. */
function restoreOriginal(ch: SpeedGroupChain, info: ClipSpeedCurve, partnerOrig: Map<string, string>, inChains: Set<string>): Clip {
  const p0 = ch.pieces[0]; const n = ch.pieces.length;
  const S = p0.duration - info.trimStart - info.trimEnd;
  const speed = p0.speedCurve?.origin?.speed ?? 1;
  const keyframes = ch.pieces.flatMap((p, i) => p.keyframes.map((k) => ({ ...k, time: ((S * i) / n + k.time * p.speed) / speed })));
  const ext = (p0.linkedClipIds ?? []).filter((l) => !inChains.has(l));
  const partners = (p0.linkedClipIds ?? []).map((l) => partnerOrig.get(l)).filter((x): x is string => !!x);
  const links = [...partners, ...ext];
  const orig: Clip = { ...p0, trimStart: info.trimStart, trimEnd: info.trimEnd, speed, keyframes, linkedClipIds: links.length ? links : undefined };
  delete orig.speedCurve;
  const anim = p0.speedCurve?.origin?.anim;
  if (anim) orig.anim = anim; else delete orig.anim;
  const last = ch.pieces[n - 1];
  if (last.fadeOut !== undefined) orig.fadeOut = last.fadeOut; else delete orig.fadeOut;
  return orig;
}

export interface ReapplyResult extends RampResult { ok: boolean; reason?: string }

/** Replace ALL pieces of the clip's speed-curve group by a new curve over the original source span (undo = one commit of the returned timeline). */
export function reapplySpeedCurve(timeline: Timeline, clipId: string, curve: SpeedCurve, opts: { steps?: number; ripple?: boolean } = {}): ReapplyResult {
  const insp = inspectSpeedGroup(timeline, clipId);
  if (!insp.ok) return { timeline, clipIds: [], ok: false, reason: insp.reason };
  const info = normalizeClipSpeedCurve(insp.target.pieces[0].speedCurve) as ClipSpeedCurve;
  const allPieces = new Set(insp.chains.flatMap((c) => c.pieces.map((p) => p.id)));
  const partnerOrig = new Map<string, string>(); // any piece id of a chain -> that chain's original id (links point at piece 0 ids, but be tolerant)
  for (const ch of insp.chains) for (const p of ch.pieces) partnerOrig.set(p.id, ch.origId);
  const origs = new Map(insp.chains.map((ch) => [ch.origId, restoreOriginal(ch, info, partnerOrig, allPieces)]));
  // 1. collapse the pieces back into the original clips; later clips on those tracks move back by the length difference (applySpeedRamp then ripples by the new one)
  let clips = timeline.clips.flatMap((x) => { const o = origs.get(x.id); if (o) return [o]; return allPieces.has(x.id) ? [] : [x]; });
  if (opts.ripple !== false) {
    for (const ch of insp.chains) {
      const o = origs.get(ch.origId) as Clip;
      const oldEnd = clipEndTime(ch.pieces[ch.pieces.length - 1]);
      const delta = clipEndTime(o) - oldEnd;
      clips = clips.map((x) => (!origs.has(x.id) && x.trackId === ch.trackId && x.startTime >= oldEnd - EPS ? { ...x, startTime: Math.max(0, x.startTime + delta) } : x));
    }
  }
  const lastToOrig = new Map(insp.chains.map((ch) => [ch.pieces[ch.pieces.length - 1].id, ch.origId]));
  const transitions = (timeline.transitions ?? []).map((t) => (lastToOrig.has(t.clipAId) ? { ...t, clipAId: lastToOrig.get(t.clipAId) as string } : t));
  const collapsed = { ...timeline, clips, transitions };
  const collapsedTl = { ...collapsed, duration: calculateTimelineDuration(collapsed) };
  // 2. cut the restored original again with the new curve
  const r = applySpeedCurveGroup(collapsedTl, insp.target.origId, curve, opts);
  if (!r.clipIds.length) return { timeline, clipIds: [], ok: false, reason: 'The speed curve could not be applied.' };
  return { ...r, ok: true };
}
