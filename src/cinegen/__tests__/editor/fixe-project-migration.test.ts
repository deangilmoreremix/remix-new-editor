// Fix E (3): versioned load migration of the legacy transition layout (B shifted, later clips / B's audio not).
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { addGlTransition } from '@cinegen/lib/occ/transitions';
import { normaliseLegacyTransitions, migrateLoadedTimelines, PROJECT_SCHEMA_VERSION } from '@cinegen/lib/editor/project-migrations';
import type { Timeline } from '@cinegen/types/timeline';
import type { Asset } from '@cinegen/types/project';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;
const starts = (tl: Timeline) => Object.fromEntries(tl.clips.map((c) => [c.id, Math.round(c.startTime * 1e6) / 1e6]));

function chain() {
  let tl = createDefaultTimeline('t');
  for (const [i, id] of ['A', 'B', 'C'].entries()) tl = addClipToTrack(tl, T(tl, 'V1'), asset(id), i * 3);
  tl = { ...tl, duration: 9, clips: tl.clips.map((c) => ({ ...c, trimStart: 2, trimEnd: 5, duration: 10 })) };
  const v = (id: string) => tl.clips.find((c) => c.assetId === id && c.trackId === T(tl, 'V1'))!;
  return { tl, a: v('A'), b: v('B'), c: v('C') };
}
/** What the OLD addTransition produced: only clip B moved left by the overlap (its audio and everything after stayed). */
function legacyAdd(tl: Timeline, aId: string, bId: string, dur: number): Timeline {
  const withTr = addGlTransition(tl, tl.clips.find((c) => c.id === aId)!, tl.clips.find((c) => c.id === bId)!, 'cross-dissolve', dur);
  return { ...withTr, clips: tl.clips.map((c) => (c.id === bId ? { ...c, startTime: c.startTime - dur } : c)), duration: tl.duration - dur };
}

describe('Fix E: legacy transition layout migration', () => {
  it('closes the gap after B (later clips and their audio move left), and re-syncs B\'s linked audio', () => {
    const { tl, a, b, c } = chain();
    const legacy = legacyAdd(tl, a.id, b.id, 0.5);
    // the legacy layout really has the gap and the late audio
    const bAud = legacy.clips.find((k) => k.assetId === 'B' && k.trackId !== b.trackId)!;
    expect(bAud.startTime).toBeCloseTo(3, 9); expect(legacy.clips.find((k) => k.id === b.id)!.startTime).toBeCloseTo(2.5, 9);
    const { timeline, reports } = normaliseLegacyTransitions(legacy);
    expect(reports).toHaveLength(1);
    const expected = addGlTransition(tl, a, b, 'cross-dissolve', 0.5); // what the current code produces from the same edit
    expect(starts(timeline)).toEqual(starts(expected));
    expect(timeline.duration).toBeCloseTo(expected.duration, 9);
    expect(timeline.clips.find((k) => k.id === c.id)!.startTime).toBeCloseTo(5.5, 9);
    expect(timeline.clips.find((k) => k.assetId === 'C' && k.trackId !== c.trackId)!.startTime).toBeCloseTo(5.5, 9); // C's audio moved with C
    expect(timeline.clips.find((k) => k.id === bAud.id)!.startTime).toBeCloseTo(2.5, 9);
  });

  it('a project already in the new layout is not touched (same object)', () => {
    const { tl, a, b } = chain();
    const fresh = addGlTransition(tl, a, b, 'cross-dissolve', 0.5);
    const r = normaliseLegacyTransitions(fresh);
    expect(r.timeline).toBe(fresh); expect(r.reports).toHaveLength(0);
    const m = migrateLoadedTimelines([fresh], undefined);
    expect(m.timelines[0]).toBe(fresh);
  });

  it('is idempotent and versioned: a second run changes nothing, a stamped project is never inspected', () => {
    const { tl, a, b } = chain();
    const legacy = legacyAdd(tl, a.id, b.id, 0.5);
    const once = migrateLoadedTimelines([legacy], undefined);
    expect(once.version).toBe(PROJECT_SCHEMA_VERSION); expect(once.reports).toHaveLength(1);
    const twice = migrateLoadedTimelines(once.timelines, undefined); // even without the stamp the result is already normal
    expect(twice.reports).toHaveLength(0); expect(starts(twice.timelines[0])).toEqual(starts(once.timelines[0]));
    const stamped = migrateLoadedTimelines([legacy], PROJECT_SCHEMA_VERSION);
    expect(stamped.timelines[0]).toBe(legacy); expect(stamped.reports).toHaveLength(0);
  });

  it('A-B-C legacy chain whose second transition no longer lines up is only normalised where the layout is recognisable (never guessed)', () => {
    const { tl, a, b, c } = chain();
    let legacy = legacyAdd(tl, a.id, b.id, 0.5);
    legacy = legacyAdd(legacy, b.id, c.id, 0.4); // old add moved only C by 0.4: B ends 5.5, C starts 5.6 -> a 0.1 gap, not an overlap
    const r = normaliseLegacyTransitions(legacy);
    const st = starts(r.timeline);
    expect(st[b.id]).toBeCloseTo(2.5, 6); // A-B untouched here: the clip after B (C) does not sit exactly `overlap` after B's end
    expect(st[c.id]).toBeCloseTo(5.6, 6); // C is not moved on a guess
  });

  it('save -> load -> save is stable (JSON round trip with the version stamp, then again unstamped)', () => {
    const { tl, a, b } = chain();
    const legacy = legacyAdd(tl, a.id, b.id, 0.5);
    const load = (saved: { timelines: Timeline[]; projectSchemaVersion?: number }) => { const m = migrateLoadedTimelines(JSON.parse(JSON.stringify(saved.timelines)), saved.projectSchemaVersion); return { timelines: m.timelines, projectSchemaVersion: PROJECT_SCHEMA_VERSION }; };
    const s1 = load({ timelines: [legacy] });
    const s2 = load(JSON.parse(JSON.stringify(s1)));
    const s3 = load(JSON.parse(JSON.stringify(s2)));
    expect(JSON.stringify(s2)).toBe(JSON.stringify(s1)); expect(JSON.stringify(s3)).toBe(JSON.stringify(s1));
    const unstamped = load({ timelines: s1.timelines });
    expect(JSON.stringify(unstamped)).toBe(JSON.stringify(s1));
  });

  it('a plain gap that is not the overlap is left alone', () => {
    const { tl, a, b, c } = chain();
    const withTr = addGlTransition(tl, a, b, 'cross-dissolve', 0.5);
    const gapped = { ...withTr, clips: withTr.clips.map((k) => (k.id === c.id ? { ...k, startTime: k.startTime + 1.25 } : k)) };
    expect(normaliseLegacyTransitions(gapped).timeline).toBe(gapped);
  });
});
