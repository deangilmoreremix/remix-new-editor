// [remix] Stage 1: insert edit and overwrite edit (pure, seconds). A source range of a media-pool asset is placed at a time on a track:
//  - insert: makes room by splitting clips that straddle the point on every unlocked track and rippling everything after it later
//    (markers move too); a dissolve that would be pulled apart by the ripple is removed.
//  - overwrite: replaces what is under [at, at + length) on the target track(s); nothing moves.
// A video asset on a video track also places its linked audio clip (first unlocked audio track), like dropping it from the library.
// Built on timeline-operations' splitClip so keyframes and linked clips are split by the existing, tested logic.
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { clipEffectiveDuration, clipEndTime } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';
import { generateId } from '@cinegen/lib/utils/ids';
import { addTrack, calculateTimelineDuration, splitClip } from '../timeline-operations';
import { resolveRange } from './source-range';

const EPS = 1e-6;
export const DEFAULT_STILL_DURATION = 5;

export interface EditRequest {
  asset: Pick<Asset, 'id' | 'name' | 'type' | 'duration'>;
  /** source range in seconds; omitted = the whole asset */
  range?: { in: number; out: number } | null;
  trackId: string;
  /** timeline time the edit starts at */
  at: number;
  /** place the asset's audio as a linked clip too (default true) */
  withAudio?: boolean;
}
export interface EditResult { timeline: Timeline; clipIds: string[]; error?: string }

const finish = (tl: Timeline): Timeline => ({ ...tl, duration: calculateTimelineDuration(tl) });

function assetDuration(a: EditRequest['asset']): number {
  return typeof a.duration === 'number' && a.duration > 0 ? a.duration : DEFAULT_STILL_DURATION;
}

function makeClip(a: EditRequest['asset'], trackId: string, start: number, range: { in: number; out: number }, label = ''): Clip {
  const dur = assetDuration(a);
  return {
    id: generateId(), assetId: a.id, trackId, name: `${a.name}${label}`, startTime: Math.max(0, start), duration: dur,
    trimStart: range.in, trimEnd: Math.max(0, dur - range.out), speed: 1, opacity: 1, volume: 1, flipH: false, flipV: false, keyframes: [],
  };
}

/** Targets of an edit: the requested track and, for video on a video track, the first unlocked audio track (created when missing). */
function plan(tl: Timeline, req: EditRequest): { tl: Timeline; error?: string; videoTrackId: string; audioTrackId?: string } {
  const track = tl.tracks.find((t) => t.id === req.trackId);
  if (!track) return { tl, error: 'Target track not found', videoTrackId: req.trackId };
  if (track.locked) return { tl, error: 'Target track is locked', videoTrackId: req.trackId };
  if (!(track.kind === 'video' && req.asset.type === 'video' && req.withAudio !== false)) return { tl, videoTrackId: track.id };
  let out = tl;
  let audio = out.tracks.find((t) => t.kind === 'audio' && !t.locked);
  if (!audio) { out = addTrack(out, 'audio'); audio = out.tracks.filter((t) => t.kind === 'audio').at(-1); }
  return { tl: out, videoTrackId: track.id, audioTrackId: audio?.id };
}

function place(tl: Timeline, req: EditRequest, range: { in: number; out: number }, videoTrackId: string, audioTrackId: string | undefined): EditResult {
  const main = makeClip(req.asset, videoTrackId, req.at, range);
  const clips = [main];
  if (audioTrackId) {
    const audio = makeClip(req.asset, audioTrackId, req.at, range, ' (audio)');
    main.linkedClipIds = [audio.id];
    audio.linkedClipIds = [main.id];
    clips.push(audio);
  }
  return { timeline: finish({ ...tl, clips: [...tl.clips, ...clips] }), clipIds: clips.map((c) => c.id) };
}

/** Which clip each piece came from, so a transition on the END of a clip can follow the piece that now holds that end. */
type Lineage = Map<string, string>;
const rootOf = (l: Lineage, id: string) => l.get(id) ?? id;

function splitStraddlers(tl: Timeline, time: number, trackIds: Set<string>, lineage: Lineage): Timeline {
  let out = tl;
  for (let guard = 0; guard < tl.clips.length * 2 + 4; guard++) {
    const c = out.clips.find((x) => trackIds.has(x.trackId) && x.startTime < time - EPS && clipEndTime(x) > time + EPS);
    if (!c) break;
    const known = new Set(out.clips.map((x) => x.id));
    const before = out.clips;
    out = splitClip(out, c.id, time);
    // splitClip also splits linked clips: record the new second half of each clip that was cut
    for (const n of out.clips) {
      if (known.has(n.id)) continue;
      const src = before.find((b) => b.trackId === n.trackId && b.assetId === n.assetId && b.startTime < time - EPS && clipEndTime(b) > time + EPS);
      if (src) lineage.set(n.id, rootOf(lineage, src.id));
    }
  }
  return out;
}

/** After splits: a transition that acts on the end of a clip (dissolve out, fade to black) moves to the piece holding that end. */
function followEnds(tl: Timeline, lineage: Lineage): Timeline {
  if (!lineage.size) return tl;
  const endPiece = new Map<string, Clip>();
  for (const c of tl.clips) {
    const root = rootOf(lineage, c.id);
    const cur = endPiece.get(root);
    if (!cur || clipEndTime(c) > clipEndTime(cur) + EPS) endPiece.set(root, c);
  }
  return { ...tl, transitions: (tl.transitions ?? []).map((t) => { if (!(t.type === 'fadeToBlack' || t.clipBId)) return t; const e = endPiece.get(rootOf(lineage, t.clipAId)); return e && e.id !== t.clipAId ? { ...t, clipAId: e.id } : t; }) };
}

function dropClips(tl: Timeline, ids: Set<string>): Timeline {
  if (!ids.size) return tl;
  return {
    ...tl,
    clips: tl.clips.filter((c) => !ids.has(c.id)).map((c) => {
      if (!c.linkedClipIds) return c;
      const kept = c.linkedClipIds.filter((l) => !ids.has(l));
      return kept.length === c.linkedClipIds.length ? c : { ...c, linkedClipIds: kept.length ? kept : undefined };
    }),
    transitions: (tl.transitions ?? []).filter((t) => !ids.has(t.clipAId) && !(t.clipBId && ids.has(t.clipBId))),
  };
}

export function insertEdit(timeline: Timeline, req: EditRequest): EditResult {
  const p = plan(timeline, req);
  if (p.error) return { timeline, clipIds: [], error: p.error };
  const range = resolveRange(req.range ? { assetId: req.asset.id, markIn: req.range.in, markOut: req.range.out } : null, assetDuration(req.asset));
  const len = range.out - range.in;
  const at = Math.max(0, req.at);
  const unlocked = new Set(p.tl.tracks.filter((t) => !t.locked).map((t) => t.id));

  const lineage: Lineage = new Map();
  let tl = followEnds(splitStraddlers(p.tl, at, unlocked, lineage), lineage);
  const moved = new Set(tl.clips.filter((c) => unlocked.has(c.trackId) && c.startTime >= at - EPS).map((c) => c.id));
  tl = {
    ...tl,
    clips: tl.clips.map((c) => (moved.has(c.id) ? { ...c, startTime: c.startTime + len } : c)),
    markers: (tl.markers ?? []).map((m) => (m.time >= at - EPS ? { ...m, time: m.time + len } : m)),
    // a dissolve whose two clips no longer overlap (only one of them moved) cannot survive the ripple
    transitions: (tl.transitions ?? []).filter((t) => !(t.clipBId && moved.has(t.clipAId) !== moved.has(t.clipBId))),
  };
  return place(tl, req, range, p.videoTrackId, p.audioTrackId);
}

export function overwriteEdit(timeline: Timeline, req: EditRequest): EditResult {
  const p = plan(timeline, req);
  if (p.error) return { timeline, clipIds: [], error: p.error };
  const range = resolveRange(req.range ? { assetId: req.asset.id, markIn: req.range.in, markOut: req.range.out } : null, assetDuration(req.asset));
  const at = Math.max(0, req.at);
  const end = at + (range.out - range.in);
  const targets = new Set([p.videoTrackId, ...(p.audioTrackId ? [p.audioTrackId] : [])]);

  const lineage: Lineage = new Map();
  let tl = splitStraddlers(p.tl, at, targets, lineage);
  tl = followEnds(splitStraddlers(tl, end, targets, lineage), lineage);
  const covered = new Set(tl.clips.filter((c) => targets.has(c.trackId) && c.startTime >= at - EPS && clipEndTime(c) <= end + EPS && clipEffectiveDuration(c) > 0).map((c) => c.id));
  tl = dropClips(tl, covered);
  return place(tl, req, range, p.videoTrackId, p.audioTrackId);
}
