// @vitest-environment jsdom
// End to end for the published viewer: CineGen timeline + a HyperFrames animation
// overlay -> buildPublishState -> buildViewerModel -> the SAME Player/TimelineComposition
// the watch page mounts. The animation layer must actually reach the renderer.
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

vi.mock('../hyperframes/HyperframesLayer.jsx', () => ({
  HyperframesLayer: ({ layer }) => <div data-testid="hf-layer" data-id={layer.id} data-block={layer.blockId} />,
}));

import { buildPublishState } from '../../../../cinegen/lib/leads/publish-state.ts';
import { buildViewerModel } from '../../publish/interactivePlayer.js';
import { createPreviewEngine } from '../previewEngine.jsx';

const timeline = { id: 't', name: 't', tracks: [{ id: 'tv', kind: 'video' }], clips: [], duration: 10, transitions: [], markers: [] };
const overlays = [{ id: 'hf1', type: 'hyperframes', name: 'Anim', start: 0, end: 5, blockId: 'bar-chart-race', props: {}, blockWidth: 1920, blockHeight: 1080 }];

describe('published playback renders HyperFrames animations', () => {
  it('reaches the renderer through the real watch-page engine', async () => {
    const state = buildPublishState(timeline, [], overlays, 'Demo');
    const model = buildViewerModel(state, null, { fps: 30 });
    expect(model.layers.some((l) => l.kind === 'hyperframes')).toBe(true);

    const host = document.createElement('div');
    document.body.appendChild(host);
    let engine;
    await act(async () => { engine = createPreviewEngine(host, { model }); });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    const el = host.querySelector('[data-testid="hf-layer"]');
    expect(el, 'HyperframesLayer was never mounted by the published-viewer engine').not.toBeNull();
    expect(el.getAttribute('data-id')).toBe('hf1');
    engine?.destroy?.();
  });
});
