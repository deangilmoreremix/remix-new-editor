import { describe, expect, it } from 'vitest';
import { timelineToComposition } from '../timelineToComposition.js';
import { buildViewerModel } from '../../publish/interactivePlayer.js';

// Published playback must render HyperFrames/RemotionUI animation overlays the
// same way the editor preview and MP4 export do (they used to be dropped).
const project = {
  timelineSeconds: 10,
  tracks: [
    { id: 'v', type: 'video', items: [] },
    { id: 'ov', type: 'text', items: [
      { id: 'hf1', type: 'hyperframes', name: 'Anim', start: 2, end: 5, blockId: 'bar-chart-race', props: {}, blockWidth: 1920, blockHeight: 1080 },
    ] },
  ],
};

describe('hyperframes overlays in the shared composition', () => {
  it('timelineToComposition emits a hyperframes layer with the right timing', () => {
    const model = timelineToComposition(project, { fps: 30 });
    const layer = model.layers.find((l) => l.kind === 'hyperframes');
    expect(layer).toBeTruthy();
    expect(layer.id).toBe('hf1');
    expect(layer.blockId).toBe('bar-chart-race');
    expect(layer.from).toBe(60);
    expect(layer.durationInFrames).toBe(90);
    expect(model.skipped ?? []).toHaveLength(0);
  });

  it('the published viewer model keeps the animation', () => {
    const model = buildViewerModel(project, null, { fps: 30 });
    expect(model.layers.some((l) => l.kind === 'hyperframes' && l.id === 'hf1')).toBe(true);
  });
});
