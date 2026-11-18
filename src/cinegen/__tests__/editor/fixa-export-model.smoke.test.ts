// Not a regression test: builds the REAL export models for Fix A (GL transition keeps each clip's own look; compound clip's own anim/fx) through
// the same chain as export-tab + web-api (timeline ops -> flattenCompounds -> export mapping -> timelineToComposition -> glTransitions + looks)
// and writes JSON for docs/stage-9/smoke/fixa-export-smoke.cjs (real export runner in headless Chromium).
// Runs only with FIXA_MODEL_OUT=<dir> FIXA_MEDIA_BASE=<url prefix serving A.webm and B.webm (6 s each, 640x360)>.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultTimeline, addClipToTrack, updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTransitionsFromTimeline, exportTracksFromTimeline, buildExportState, exportItem } from '@cinegen/lib/editor/export-mapping';
import { buildGlTransitionLayers, attachGlSideLooks } from '@cinegen/lib/editor/gl-transition-export';
import { addGlTransition } from '@cinegen/lib/occ/transitions';
import { createCompound, flattenCompounds } from '@cinegen/lib/editor/stage1';
// @ts-expect-error plain JS modules
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
// @ts-expect-error plain JS modules
import { glSideLayerFrom } from '../../../lib/editor/remotion/glSideLook.js';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const OUT = process.env.FIXA_MODEL_OUT; const BASE = process.env.FIXA_MEDIA_BASE;
const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `${BASE}/${id}.webm`, duration: 6, createdAt: '2026-01-01' });
const ASSETS = () => [asset('A'), asset('B')];

function modelOf(tl: Timeline, withLooks: boolean) {
  const flat = flattenCompounds(tl);
  const clips = exportClipsFromTimeline(flat, ASSETS());
  const transitions = exportTransitionsFromTimeline(flat);
  const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(flat), transitions, totalDuration: flat.duration }, exportItem);
  const model = timelineToComposition(state, { fps: 30, quality: '720p' }) as Record<string, unknown> & { layers: never[] };
  const specs = buildGlTransitionLayers(transitions, clips as never, 30);
  model.glTransitions = withLooks ? attachGlSideLooks(specs, clips as never, model.layers, glSideLayerFrom) : specs;
  return model;
}
const write = (name: string, model: unknown) => { fs.mkdirSync(OUT!, { recursive: true }); fs.writeFileSync(path.join(OUT!, `${name}.json`), JSON.stringify(model)); };

/** V1: A 0-3 (3 s spare after), B 3-6 (1 s spare before). A keyed x 0 -> 30 % over its 3 s + exposure +1.5 stops; B keyed x -30 -> 0 % over its 3 s. 1 s GL transition. */
function glTimeline(glType: string) {
  let tl = createDefaultTimeline('t');
  const v1 = tl.tracks.find((t) => t.name === 'V1')!.id;
  tl = addClipToTrack(tl, v1, ASSETS()[0], 0); tl = addClipToTrack(tl, v1, ASSETS()[1], 3);
  const [a, b] = tl.clips.filter((c) => c.trackId === v1);
  tl = { ...tl, duration: 6, clips: tl.clips.map((c) => (c.assetId === 'A' ? { ...c, duration: 6, trimEnd: 3 } : c.assetId === 'B' ? { ...c, duration: 6, trimStart: 1, trimEnd: 2 } : c)) };
  tl = updateClipProperties(tl, a.id, { anim: { keys: { x: [{ t: 0, v: 0, ease: 'linear' }, { t: 3, v: 30, ease: 'linear' }] } }, fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1.5 } } as never] });
  tl = updateClipProperties(tl, b.id, { anim: { keys: { x: [{ t: 0, v: -30, ease: 'linear' }, { t: 3, v: 0, ease: 'linear' }] } } });
  tl = addGlTransition(tl, tl.clips.find((c) => c.id === a.id)!, tl.clips.find((c) => c.id === b.id)!, glType, 1);
  return tl;
}

/** V1: A 0-3 and B 3-6 nested in one compound; the compound's own anim x -30 -> +30 % over 6 s and exposure +1.5. */
function compoundTimeline(withLook: boolean) {
  let tl = createDefaultTimeline('t');
  const v1 = tl.tracks.find((t) => t.name === 'V1')!.id;
  tl = addClipToTrack(tl, v1, ASSETS()[0], 0); tl = addClipToTrack(tl, v1, ASSETS()[1], 3);
  tl = { ...tl, duration: 6, clips: tl.clips.map((c) => (c.assetId === 'A' ? { ...c, duration: 6, trimEnd: 3 } : { ...c, duration: 6, trimEnd: 3 })) };
  const r = createCompound(tl, tl.clips.filter((c) => c.trackId === v1).map((c) => c.id));
  return withLook ? updateClipProperties(r.timeline, r.compoundId as string, { anim: { keys: { x: [{ t: 0, v: -30, ease: 'linear' }, { t: 6, v: 30, ease: 'linear' }] } }, fx: [{ id: 'builtin:fx-exposure', props: { exposure: 1.5 } } as never] }) : r.timeline;
}

describe.skipIf(!OUT || !BASE)('Fix A export model builder', () => {
  it('builds the GL transition models (with looks, legacy raw, and the plain-no-transition baseline)', () => {
    const tl = glTimeline('cross-dissolve');
    expect(tl.transitions).toHaveLength(1);
    const withLooks = modelOf(tl, true); const legacy = modelOf(tl, false);
    const g = (withLooks.glTransitions as Array<{ outLook?: unknown; innLook?: unknown }>)[0];
    expect(g.outLook && g.innLook).toBeTruthy();
    expect((legacy.glTransitions as Array<{ outLook?: unknown }>)[0].outLook).toBeUndefined();
    write('gl-new', withLooks); write('gl-legacy', legacy);
  });
  it('builds the compound models', () => {
    write('comp-new', modelOf(compoundTimeline(true), true));
    write('comp-base', modelOf(compoundTimeline(false), true));
  });
});
