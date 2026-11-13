// [remix] Persistent multicam groups on the CineGen timeline. OpenChatCut keeps a multicam group (its angles, each with synced source
// placement) plus an ordered list of angle decisions (multicam/groups.ts + changeCam.ts persistent decisions) so a switch can be revised later.
// Their reducer-based plan cannot run on CineGen's Clip model, so the same group + decision concepts are kept as `Timeline.multicam` and the
// decisions are materialised into ordinary clips: preview and export need no new renderer, and the existing one-shot `cutToCamera` stays.
import { generateId } from '@cinegen/lib/utils/ids';
import { clipEffectiveDuration, clipEndTime, type Clip, type Timeline } from '@cinegen/types/timeline';

export interface McAngle { id: string; name: string; trackId: string; /** original clips of this angle: the video clip first, then its linked audio */ parts: Clip[] }
export interface McDecision { id: string; angleId: string; from: number; to: number }
export interface McGroup { id: string; name: string; start: number; end: number; angles: McAngle[]; decisions: McDecision[] }
export type MulticamTimeline = Timeline & { multicam?: McGroup[] };
export type McClip = Clip & { multicam?: { groupId: string; angleId: string } };

const EPS = 0.02;
const kindOf = (tl: Timeline, trackId: string) => tl.tracks.find((t) => t.id === trackId)?.kind;
const withDuration = (tl: Timeline): Timeline => ({ ...tl, duration: Math.max(0, ...tl.clips.map(clipEndTime)) });

/** Effective decisions: later decisions override earlier ones; adjacent equal angles merge; ranges outside [start,end] are dropped. */
export function normalizeDecisions(group: Pick<McGroup, 'start' | 'end' | 'decisions' | 'angles'>): McDecision[] {
  const cuts = new Set<number>([group.start, group.end]);
  group.decisions.forEach((d) => { cuts.add(Math.max(group.start, Math.min(group.end, d.from))); cuts.add(Math.max(group.start, Math.min(group.end, d.to))); });
  const pts = [...cuts].sort((a, b) => a - b);
  const out: McDecision[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]; const b = pts[i + 1];
    if (b - a < EPS) continue;
    const mid = (a + b) / 2;
    const hit = [...group.decisions].reverse().find((d) => mid >= d.from && mid < d.to);
    const angleId = hit?.angleId ?? group.angles[0]?.id;
    if (!angleId) continue;
    const prev = out[out.length - 1];
    if (prev && prev.angleId === angleId && Math.abs(prev.to - a) < EPS) prev.to = b; else out.push({ id: `${(hit?.id ?? 'd').split('@')[0]}@${a.toFixed(2)}`, angleId, from: a, to: b }); // unique per segment, so one piece can be removed on its own
  }
  return out;
}

/** Rebuild the group's clips from its source angles and decisions. Everything else on the timeline is untouched. */
export function materializeGroup(tl: MulticamTimeline, group: McGroup): MulticamTimeline {
  const kept = tl.clips.filter((c) => (c as McClip).multicam?.groupId !== group.id);
  const made: McClip[] = [];
  for (const seg of normalizeDecisions(group)) {
    const angle = group.angles.find((a) => a.id === seg.angleId);
    if (!angle) continue;
    const idMap = new Map<string, string>();
    const pieces: McClip[] = [];
    for (const part of angle.parts) {
      const a = Math.max(seg.from, part.startTime); const b = Math.min(seg.to, clipEndTime(part));
      if (b - a < EPS) continue;
      const nid = generateId();
      idMap.set(part.id, nid);
      const trimStart = part.trimStart + (a - part.startTime) * part.speed;
      const trimEnd = Math.max(0, part.duration - trimStart - (b - a) * part.speed);
      pieces.push({ ...part, id: nid, startTime: a, trimStart, trimEnd, multicam: { groupId: group.id, angleId: angle.id } });
    }
    for (const p of pieces) {
      const links = (p.linkedClipIds ?? []).map((l) => idMap.get(l)).filter((x): x is string => !!x);
      p.linkedClipIds = links.length ? links : undefined;
    }
    made.push(...pieces);
  }
  return withDuration({ ...tl, clips: [...kept, ...made] });
}

const groupsOf = (tl: MulticamTimeline): McGroup[] => tl.multicam ?? [];
const withGroup = (tl: MulticamTimeline, g: McGroup): MulticamTimeline => materializeGroup({ ...tl, multicam: groupsOf(tl).some((x) => x.id === g.id) ? groupsOf(tl).map((x) => (x.id === g.id ? g : x)) : [...groupsOf(tl), g] }, g);

/** Group the given video clips (one angle per clip, its linked audio travels with it). The first clip is the active angle everywhere. */
export function createGroup(tl: MulticamTimeline, clipIds: string[], name?: string): MulticamTimeline | { error: string } {
  const picked = clipIds.map((id) => tl.clips.find((c) => c.id === id)).filter((c): c is Clip => !!c && kindOf(tl, c.trackId) === 'video');
  if (picked.length < 2) return { error: 'Pick at least two video clips on different tracks.' };
  if (new Set(picked.map((c) => c.trackId)).size !== picked.length) return { error: 'Each camera must be on its own track.' };
  if (picked.some((c) => (c as McClip).multicam)) return { error: 'One of these clips already belongs to a multicam group.' };
  const taken = new Set<string>();
  const angles: McAngle[] = picked.map((c, i) => {
    const parts = [c, ...(c.linkedClipIds ?? []).map((id) => tl.clips.find((x) => x.id === id)).filter((x): x is Clip => !!x)];
    parts.forEach((p) => taken.add(p.id));
    return { id: `cam${i + 1}`, name: c.name || `Camera ${i + 1}`, trackId: c.trackId, parts };
  });
  const start = Math.min(...picked.map((c) => c.startTime)); const end = Math.max(...picked.map(clipEndTime));
  const g: McGroup = { id: generateId(), name: name || `Multicam ${groupsOf(tl).length + 1}`, start, end, angles, decisions: [{ id: generateId(), angleId: angles[0].id, from: start, to: end }] };
  return withGroup({ ...tl, clips: tl.clips.filter((c) => !taken.has(c.id)) }, g);
}

/** Switch to `angleId` for [from, to): earlier switches inside that range are overridden (and can be changed again later). */
export function setAngle(tl: MulticamTimeline, groupId: string, angleId: string, from: number, to: number): MulticamTimeline | { error: string } {
  const g = groupsOf(tl).find((x) => x.id === groupId);
  if (!g || !g.angles.some((a) => a.id === angleId)) return { error: 'That camera is not in the group.' };
  if (!(to - from > EPS)) return { error: 'The switch needs a length.' };
  const decisions = normalizeDecisions({ ...g, decisions: [...g.decisions, { id: generateId(), angleId, from, to }] });
  return withGroup(tl, { ...g, decisions });
}

export function removeDecision(tl: MulticamTimeline, groupId: string, decisionId: string): MulticamTimeline {
  const g = groupsOf(tl).find((x) => x.id === groupId);
  if (!g) return tl;
  // removing a switch hands its range back to the first camera
  const d = g.decisions.find((x) => x.id === decisionId);
  const decisions = d ? normalizeDecisions({ ...g, decisions: [...g.decisions.filter((x) => x.id !== decisionId), { id: generateId(), angleId: g.angles[0].id, from: d.from, to: d.to }] }) : g.decisions;
  return withGroup(tl, { ...g, decisions });
}

/** Re-sync one angle: shift its source clips by `deltaSec` on the timeline (positive = later). */
export function nudgeAngle(tl: MulticamTimeline, groupId: string, angleId: string, deltaSec: number): MulticamTimeline {
  const g = groupsOf(tl).find((x) => x.id === groupId);
  if (!g) return tl;
  const angles = g.angles.map((a) => (a.id === angleId ? { ...a, parts: a.parts.map((p) => ({ ...p, startTime: Math.max(0, p.startTime + deltaSec) })) } : a));
  return withGroup(tl, { ...g, angles });
}

/** Remove the group. `restore` puts the original, uncut clips back; otherwise the current cut stays as plain clips. */
export function deleteGroup(tl: MulticamTimeline, groupId: string, restore: boolean): MulticamTimeline {
  const g = groupsOf(tl).find((x) => x.id === groupId);
  if (!g) return tl;
  const rest = groupsOf(tl).filter((x) => x.id !== groupId);
  let clips = tl.clips;
  if (restore) clips = [...clips.filter((c) => (c as McClip).multicam?.groupId !== groupId), ...g.angles.flatMap((a) => a.parts)];
  else clips = clips.map((c) => { const { multicam: _m, ...plain } = c as McClip; return (c as McClip).multicam?.groupId === groupId ? plain : c; });
  return withDuration({ ...tl, multicam: rest.length ? rest : undefined, clips });
}

export const groupOfClip = (tl: MulticamTimeline, clip: Clip): McGroup | undefined => groupsOf(tl).find((g) => g.id === (clip as McClip).multicam?.groupId);
