// Fix E (2): a compound with a look of its own renders as ONE group (children offscreen, compound fx / opacity / blend / transform applied once).
import { describe, it, expect } from 'vitest';
import { createDefaultTimeline, addClipToTrack, updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { createCompound, flattenCompounds, expandCompound, groupable } from '@cinegen/lib/editor/stage1';
import { addGlTransition } from '@cinegen/lib/occ/transitions';
import { exportClipsFromTimeline, exportTracksFromTimeline, buildExportState, exportItem } from '@cinegen/lib/editor/export-mapping';
import { clipToRow, clipFromRow } from '@cinegen/lib/db-converters';
// @ts-expect-error plain JS
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `https://x.test/${id}.mp4`, duration: 10, createdAt: '2026-01-01' });
const ASSETS = [asset('A'), asset('B')];
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;

/** V1: A 0-4; V2: B 2-6 (they overlap 2-4). Both nested; the compound gets `look`. */
function overlapping(look: Record<string, unknown>) {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, T(tl, 'V1'), asset('A'), 0); tl = addClipToTrack(tl, T(tl, 'V2'), asset('B'), 2);
  tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, duration: 4, trimStart: 0, trimEnd: 0 })), duration: 6 };
  const ids = tl.clips.filter((c) => c.assetId === 'A' || c.assetId === 'B').filter((c) => [T(tl, 'V1'), T(tl, 'V2')].includes(c.trackId)).map((c) => c.id);
  const r = createCompound(tl, ids);
  return { tl: updateClipProperties(r.timeline, r.compoundId as string, look as never), cid: r.compoundId as string };
}
const pictures = (tl: Timeline) => tl.clips.filter((c) => [T(tl, 'V1'), T(tl, 'V2')].includes(c.trackId));

describe('Fix E: compound group render', () => {
  it('group opacity / fx / blend stay on the compound; the children are untouched and tagged', () => {
    const { tl, cid } = overlapping({ opacity: 0.5, blendMode: 'screen', fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1 } }] });
    const flat = flattenCompounds(tl);
    expect(flat.groups).toHaveLength(1);
    const g = flat.groups![0];
    expect(g.id).toBe(cid); expect(g.opacity).toBe(0.5); expect(g.blendMode).toBe('screen'); expect(g.fx).toHaveLength(1); expect(g.compound).toBeUndefined();
    const kids = pictures(flat);
    expect(kids).toHaveLength(2);
    for (const k of kids) { expect(k.compoundGroup).toBe(cid); expect(k.opacity).toBe(1); expect(k.fx).toBeUndefined(); expect(k.anim).toBeUndefined(); expect(k.blendMode).toBeUndefined(); }
    // the overlap region (2-4 s) has two children but ONE group opacity
    expect(kids.filter((k) => k.startTime < 4 && k.startTime + 4 > 2)).toHaveLength(2);
  });

  it('bake mode (export range / expand) keeps the per-child distribution', () => {
    const { tl, cid } = overlapping({ opacity: 0.5 });
    const baked = flattenCompounds(tl, { bake: true });
    expect(baked.groups).toBeUndefined();
    expect(pictures(baked).map((c) => c.opacity)).toEqual([0.5, 0.5]);
    const ex = expandCompound(tl, cid).timeline;
    expect(ex.groups).toBeUndefined(); expect(pictures(ex).map((c) => c.opacity)).toEqual([0.5, 0.5]); expect(ex.clips.some((c) => c.compound)).toBe(false);
  });

  it('a compound with no look of its own does not create a group; compounds with GL transitions or nested compounds keep the per-child look', () => {
    const plain = overlapping({});
    expect(flattenCompounds(plain.tl).groups).toBeUndefined();
    // inner GL transition -> not groupable
    let tl = createDefaultTimeline('t');
    tl = addClipToTrack(tl, T(tl, 'V1'), asset('A'), 0); tl = addClipToTrack(tl, T(tl, 'V1'), asset('B'), 3);
    tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, duration: 10, trimStart: 2, trimEnd: 5 })), duration: 6 };
    const [a, b] = tl.clips.filter((c) => c.trackId === T(tl, 'V1'));
    tl = addGlTransition(tl, a, b, 'cross-dissolve', 0.5);
    const r = createCompound(tl, tl.clips.filter((c) => c.trackId === T(tl, 'V1')).map((c) => c.id));
    const withLook = updateClipProperties(r.timeline, r.compoundId as string, { opacity: 0.5 });
    expect(groupable(withLook.clips.find((c) => c.id === r.compoundId)!)).toBe(false);
    const f = flattenCompounds(withLook);
    expect(f.groups).toBeUndefined(); expect(f.clips.filter((c) => c.trackId === T(tl, 'V1')).every((c) => c.opacity === 0.5)).toBe(true);
    // nested
    const inner = overlapping({}); const outer = createCompound(inner.tl, inner.tl.clips.filter((c) => c.compound).map((c) => c.id));
    const o2 = updateClipProperties(outer.timeline, outer.compoundId as string, { opacity: 0.5 });
    const nf = flattenCompounds(o2); // the outer look is baked onto the inner compound, which then renders as the group
    expect(nf.groups).toHaveLength(1); expect(nf.groups![0].id).toContain(inner.cid); expect(nf.groups![0].opacity).toBe(0.5);
  });

  it('export mapping: the group is an extra last item and the composition collects the children into it', () => {
    const { tl, cid } = overlapping({ opacity: 0.5, blendMode: 'multiply', anim: { keys: { opacity: [{ t: 0, v: 1, ease: 'linear' }, { t: 6, v: 0.2, ease: 'linear' }] } } });
    const flat = flattenCompounds(tl);
    const clips = exportClipsFromTimeline(flat, ASSETS);
    const last = clips[clips.length - 1];
    expect(last.type).toBe('group'); expect(last.id).toBe(cid); expect(last.volume).toBe(0);
    expect(clips.filter((c) => (c as { compoundGroup?: string }).compoundGroup === cid)).toHaveLength(2);
    const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(flat), totalDuration: 6 }, exportItem);
    const model = timelineToComposition(state, { fps: 30, quality: '720p' }) as { layers: Array<Record<string, any>> };
    const groups = model.layers.filter((l) => l.kind === 'group');
    expect(groups).toHaveLength(1);
    expect(groups[0].children).toHaveLength(2);
    expect(groups[0].clipBlend).toBe('multiply');
    expect(groups[0].keyframes?.opacity?.length).toBeGreaterThan(2);
    expect(model.layers.filter((l) => l.kind === 'video' || l.kind === 'image')).toHaveLength(0); // children are not layers of their own
    expect(groups[0].children.every((c: Record<string, unknown>) => c.clipBlend === undefined && c.keyframes === null)).toBe(true);
  });

  it('save / load: the compound (with its look) survives the row round trip; groups never reach the saved clips', () => {
    const { tl, cid } = overlapping({ opacity: 0.5, blendMode: 'screen' });
    const c = tl.clips.find((k) => k.id === cid)!;
    const back = clipFromRow(JSON.parse(JSON.stringify(clipToRow(c, tl.id))), []);
    expect(back.compound?.clips).toHaveLength(2); expect(back.opacity).toBe(0.5); expect(back.blendMode).toBe('screen');
    expect(JSON.stringify(tl)).not.toContain('compoundGroup'); expect(tl.groups).toBeUndefined();
    flattenCompounds(tl); expect(tl.groups).toBeUndefined(); expect(tl.clips.every((k) => !k.compoundGroup)).toBe(true); // flatten does not mutate
  });
});
