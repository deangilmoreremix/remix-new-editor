// Not a regression test: builds the REAL export models for Fix E (GL transition window with blend + opacity over a lower track + caption; compound group
// vs per-child opacity) through the export chain used by adapters/web-api.ts, and writes JSON for docs/stage-10/smoke/fixe-export-smoke.cjs.
// Runs only with FIXE_MODEL_OUT=<dir> FIXE_MEDIA_BASE=<url prefix serving A.webm B.webm L.webm (solid colours, 640x360)>.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultTimeline, addClipToTrack, updateClipProperties } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTransitionsFromTimeline, exportTracksFromTimeline, buildExportState, exportItem } from '@cinegen/lib/editor/export-mapping';
import { buildGlTransitionLayers, attachGlSideLooks } from '@cinegen/lib/editor/gl-transition-export';
import { addGlTransition } from '@cinegen/lib/occ/transitions';
import { createCompound, flattenCompounds } from '@cinegen/lib/editor/stage1';
import { CAPTION_STYLE_BY_ID } from '../../../openchatcut/captions/styles';
// @ts-expect-error plain JS
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
// @ts-expect-error plain JS
import { glSideLayerFrom } from '../../../lib/editor/remotion/glSideLook.js';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';

const OUT = process.env.FIXE_MODEL_OUT; const BASE = process.env.FIXE_MEDIA_BASE;
const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `${BASE}/${id}.webm`, duration: 10, createdAt: '2026-01-01' });
const ASSETS = () => ['A', 'B', 'L'].map(asset);
const T = (tl: Timeline, n: string) => tl.tracks.find((t) => t.name === n)!.id;

function modelOf(tl: Timeline, opts: { bake?: boolean; looks?: boolean } = {}) {
  const flat = flattenCompounds(tl, { bake: opts.bake });
  const clips = exportClipsFromTimeline(flat, ASSETS());
  const transitions = exportTransitionsFromTimeline(flat);
  const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(flat), transitions, totalDuration: flat.duration }, exportItem);
  const model = timelineToComposition(state, { fps: 30, quality: '720p' }) as Record<string, any>;
  const specs = buildGlTransitionLayers(transitions, clips as never, 30);
  model.glTransitions = opts.looks === false ? specs : attachGlSideLooks(specs, clips as never, model.layers, glSideLayerFrom);
  model.occCaptions = clips.flatMap((c) => ((c as { captions?: unknown }).captions ? [(c as { captions?: unknown }).captions] : []));
  for (const c of clips) { const cap = (c as { captions?: { template?: string } }).captions; const fam = cap?.template && (CAPTION_STYLE_BY_ID as Record<string, { fontFamily?: string } | undefined>)[cap.template]?.fontFamily; if (fam) model.fonts = [...new Set([...(model.fonts ?? []), fam])]; }
  return model;
}
const write = (name: string, model: unknown) => { fs.mkdirSync(OUT!, { recursive: true }); fs.writeFileSync(path.join(OUT!, `${name}.json`), JSON.stringify(model)); };

/** V1: L (lower track) 0-6. V2: A 0-3, B 3-6, 1 s cross-dissolve (window 2-3 s). A and B: blend `screen`, opacity 0.6; A has a caption at 2.2-2.9 s. */
function windowTimeline(withLook: boolean) {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, T(tl, 'V1'), ASSETS()[2], 0);
  tl = addClipToTrack(tl, T(tl, 'V2'), ASSETS()[0], 0); tl = addClipToTrack(tl, T(tl, 'V2'), ASSETS()[1], 3);
  tl = { ...tl, duration: 6, clips: tl.clips.map((c) => (c.assetId === 'L' ? { ...c, duration: 6, trimEnd: 0 } : { ...c, duration: 10, trimStart: 2, trimEnd: 5 })) };
  const [a, b] = tl.clips.filter((c) => c.trackId === T(tl, 'V2'));
  if (withLook) for (const c of [a, b]) tl = updateClipProperties(tl, c.id, { opacity: 0.6, blendMode: 'screen' } as never);
  tl = updateClipProperties(tl, a.id, { captions: { enabled: true, template: 'tiktok', pacing: 'phrase', words: [{ id: 'w0', text: 'WINDOW', start: 2200, end: 2900 }], offsetFrames: 0 } } as never);
  return addGlTransition(tl, tl.clips.find((c) => c.id === a.id)!, tl.clips.find((c) => c.id === b.id)!, 'cross-dissolve', 1);
}

/** V1: A 0-4; V2: B 2-6 (overlap 2-4), nested in a compound with group opacity 0.5. */
function groupTimeline() {
  let tl = createDefaultTimeline('t');
  tl = addClipToTrack(tl, T(tl, 'V1'), ASSETS()[0], 0); tl = addClipToTrack(tl, T(tl, 'V2'), ASSETS()[1], 2);
  tl = { ...tl, clips: tl.clips.map((c) => ({ ...c, duration: 4, trimStart: 0, trimEnd: 0 })), duration: 6 };
  const r = createCompound(tl, tl.clips.filter((c) => [T(tl, 'V1'), T(tl, 'V2')].includes(c.trackId)).map((c) => c.id));
  return updateClipProperties(r.timeline, r.compoundId as string, { opacity: 0.5 } as never);
}

describe.skipIf(!OUT || !BASE)('Fix E export model builder', () => {
  it('builds the models', () => {
    const w = modelOf(windowTimeline(true)); const g = (w.glTransitions as Array<{ outLayerId?: string }>)[0];
    expect(g.outLayerId).toBeTruthy();
    write('win-new', w);
    write('win-raw', modelOf(windowTimeline(true), { looks: false })); // specs without looks = the raw-frame layer drawn on top of everything
    const grp = modelOf(groupTimeline()); expect((grp.layers as Array<{ kind: string }>).some((l) => l.kind === 'group')).toBe(true);
    write('grp-group', grp);
    write('grp-baked', modelOf(groupTimeline(), { bake: true }));
  });
});
