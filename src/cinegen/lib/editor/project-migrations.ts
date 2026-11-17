// [remix] Fix E: project-load migrations, versioned so each one runs once.
//   v1 (no field): saved before addTransition / removeTransition were symmetric (Fix A) and before B's audio moved with B (Stage 8)
//   v2: LEGACY TRANSITION LAYOUT NORMALISED. Old addTransition shifted only clip B left by the overlap: the clips after B (and their audio) stayed, which left
//       a gap of exactly the overlap after B, and B's linked audio stayed `overlap` late. The new addTransition ripples the later clips left with B, so
//       removing the transition (which shifts them right by the overlap) is its exact inverse. Loading a legacy project closes that gap once.
// Pure and idempotent: a timeline already in the new layout has no such gap / offset, so nothing changes, and the saved `projectSchemaVersion` stops it
// from being looked at again.
import type { Clip, Timeline } from '@cinegen/types/timeline';
import { clipEndTime } from '@cinegen/types/timeline';
import { calculateTimelineDuration } from './timeline-operations';

export const PROJECT_SCHEMA_VERSION = 2;
const EPS = 1e-3;

export interface MigrationReport { timelineId: string; transitionId: string; shifted: number; overlap: number }

/** Normalise one timeline's legacy transition layout. Returns the same object when nothing needs to change. */
export function normaliseLegacyTransitions(timeline: Timeline): { timeline: Timeline; reports: MigrationReport[] } {
  const trs = (timeline.transitions ?? []).filter((t) => t.type === 'dissolve' && t.clipBId);
  if (!trs.length) return { timeline, reports: [] };
  let clips = timeline.clips;
  const reports: MigrationReport[] = [];
  const byId = (id: string) => clips.find((c) => c.id === id);
  // in time order of the incoming clip, so a chain A-B-C is handled left to right
  const order = [...trs].sort((a, b) => (byId(a.clipBId as string)?.startTime ?? 0) - (byId(b.clipBId as string)?.startTime ?? 0));
  for (const tr of order) {
    const A = byId(tr.clipAId); const B = byId(tr.clipBId as string);
    if (!A || !B || A.trackId !== B.trackId) continue;
    const overlap = Math.min(tr.duration, clipEndTime(A) - B.startTime);
    if (!(overlap > EPS)) continue;
    const bEnd = clipEndTime(B);
    const after = clips.filter((c) => c.trackId === B.trackId && c.id !== B.id && c.startTime >= B.startTime - EPS).sort((a, b) => a.startTime - b.startTime);
    const next = after[0];
    const move = new Map<string, number>();
    // 1. the gap after B equal to the overlap: the clips after B (and what is in sync with them) belong `overlap` earlier
    if (next && Math.abs(next.startTime - (bEnd + overlap)) < EPS) {
      for (const c of after) {
        move.set(c.id, overlap);
        for (const id of c.linkedClipIds ?? []) { const o = byId(id); if (o && Math.abs(o.startTime - c.startTime) < EPS) move.set(o.id, overlap); }
      }
    }
    // 2. B's linked clip that stayed behind (late by exactly the overlap)
    for (const id of B.linkedClipIds ?? []) {
      const o = byId(id);
      if (o && !move.has(o.id) && Math.abs(o.startTime - (B.startTime + overlap)) < EPS) move.set(o.id, overlap);
    }
    if (!move.size) continue;
    clips = clips.map((c: Clip) => (move.has(c.id) ? { ...c, startTime: c.startTime - (move.get(c.id) as number) } : c));
    reports.push({ timelineId: timeline.id, transitionId: tr.id, shifted: move.size, overlap });
  }
  if (!reports.length) return { timeline, reports };
  const out = { ...timeline, clips };
  return { timeline: { ...out, duration: calculateTimelineDuration(out) }, reports };
}

/** Run the pending migrations for a loaded project. `version` = the saved `projectSchemaVersion` (absent = 1). */
export function migrateLoadedTimelines(timelines: Timeline[], version: unknown): { timelines: Timeline[]; version: number; reports: MigrationReport[] } {
  const v = typeof version === 'number' && Number.isFinite(version) ? version : 1;
  if (v >= PROJECT_SCHEMA_VERSION) return { timelines, version: v, reports: [] };
  const reports: MigrationReport[] = [];
  const out = timelines.map((tl) => { const r = normaliseLegacyTransitions(tl); reports.push(...r.reports); return r.timeline; });
  return { timelines: reports.length ? out : timelines, version: PROJECT_SCHEMA_VERSION, reports };
}
