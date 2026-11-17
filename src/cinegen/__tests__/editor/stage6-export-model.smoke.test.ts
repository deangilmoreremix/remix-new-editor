// Not a regression test: builds the REAL export model (timeline ops -> export mapping -> timelineToComposition -> buildGlTransitionLayers,
// the same chain as export-tab + web-api) and writes it as JSON for docs/stage-6/smoke/stage6-export-smoke.cjs, which feeds it to the real
// export runner (renderMediaOnWeb) in headless Chromium. Runs only with S6_MODEL_OUT=<dir> S6_MEDIA_BASE=<url prefix of the two clips>.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createDefaultTimeline, addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { exportClipsFromTimeline, exportTransitionsFromTimeline, exportTracksFromTimeline, buildExportState, exportItem } from '@cinegen/lib/editor/export-mapping';
import { buildGlTransitionLayers } from '@cinegen/lib/editor/gl-transition-export';
import { addGlTransition } from '@cinegen/lib/occ/transitions';
// @ts-expect-error plain JS module
import { timelineToComposition } from '../../../lib/editor/remotion/timelineToComposition.js';
import type { Asset } from '@cinegen/types/project';

const OUT = process.env.S6_MODEL_OUT; const BASE = process.env.S6_MEDIA_BASE;
const asset = (id: string): Asset => ({ id, name: id, type: 'video', url: `${BASE}/${id}.webm`, duration: 4, createdAt: '2026-01-01' });

describe.skipIf(!OUT || !BASE)('stage 6 export model builder', () => {
  const variants: Record<string, { glType: string; glParams?: Record<string, number | boolean | number[]> }> = {
    'wipe-right': { glType: 'glt-directional-wipe', glParams: { direction: [1, 0], smoothness: 0 } },
    'wipe-up': { glType: 'glt-directional-wipe', glParams: { direction: [0, 1], smoothness: 0 } },
    'plain': { glType: 'cross-dissolve' },
  };
  for (const [name, v] of Object.entries(variants)) {
    it(`builds ${name}`, () => {
      const assets = [asset('A'), asset('B')];
      let tl = createDefaultTimeline('t');
      const v1 = tl.tracks.find((t) => t.name === 'V1')!.id; const v2 = tl.tracks.find((t) => t.name === 'V2')!.id;
      tl = addClipToTrack(tl, v1, assets[0], 0); tl = addClipToTrack(tl, v2, assets[1], 3);
      const vids = tl.clips.filter((c) => c.trackId === v1 || c.trackId === v2);
      tl = { ...tl, clips: tl.clips.map((c) => (c.id === vids[0].id ? { ...c, trimEnd: 1 } : c.id === vids[1].id ? { ...c, trimStart: 1 } : c)) };
      tl = addGlTransition(tl, tl.clips.find((c) => c.id === vids[0].id)!, tl.clips.find((c) => c.id === vids[1].id)!, v.glType, 1, undefined, v.glParams);
      expect(tl.transitions).toHaveLength(1);
      const clips = exportClipsFromTimeline(tl, assets);
      const transitions = exportTransitionsFromTimeline(tl);
      const { state } = buildExportState({ clips, tracks: exportTracksFromTimeline(tl), transitions, totalDuration: tl.duration }, exportItem);
      const model = timelineToComposition(state, { fps: 30, quality: '720p' }) as Record<string, unknown>;
      model.glTransitions = buildGlTransitionLayers(transitions, clips as never, 30);
      fs.mkdirSync(OUT!, { recursive: true });
      fs.writeFileSync(path.join(OUT!, `${name}.json`), JSON.stringify(model));
      expect((model.glTransitions as unknown[]).length).toBe(1);
    });
  }
});
