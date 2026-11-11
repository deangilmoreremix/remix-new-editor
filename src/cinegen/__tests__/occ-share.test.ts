// [remix] Share/Publish: CineGen timeline + overlays → the interactive project snapshot (old editor publish client).
import { describe, it, expect } from 'vitest';
import { buildPublishState } from '@cinegen/components/export/share-panel';
// @ts-expect-error plain JS
import { preparePublishProject } from '../../lib/editor/publish/publishClient.js';
import { createOverlay } from '@cinegen/lib/overlays/overlays';

describe('publish snapshot', () => {
  it('maps clips and overlays and passes the publish client checks', () => {
    const tl: any = { id: 't', name: 'T', duration: 10, tracks: [{ id: 'V1', kind: 'video' }, { id: 'A1', kind: 'audio' }], clips: [
      { id: 'c1', assetId: 'a1', trackId: 'V1', startTime: 1, duration: 6, trimStart: 1, trimEnd: 0, speed: 2, volume: 1 },
      { id: 'c2', assetId: 'a2', trackId: 'A1', startTime: 0, duration: 4, trimStart: 0, trimEnd: 0, speed: 1, volume: 0.5 }] };
    const assets: any[] = [{ id: 'a1', type: 'video', url: 'https://x/v.mp4' }, { id: 'a2', type: 'audio', url: 'https://x/a.mp3' }];
    const state = buildPublishState(tl, assets, [createOverlay('click-to-call', 2, 10)], 'My video');
    const video = state.tracks[0].items as any[];
    expect(video[0]).toMatchObject({ type: 'video', src: 'https://x/v.mp4', start: 1, end: 3.5, playbackRate: 2, trimIn: 1 });
    expect((state.tracks[1].items as any[])[0]).toMatchObject({ type: 'audio' });
    expect((state.tracks[2].items as any[]).length).toBe(1);
    const project = preparePublishProject(state, { title: 'My video' });
    expect(project.tracks).toHaveLength(3);
  });
  it('refuses blob: media (must be uploaded first)', () => {
    const tl: any = { id: 't', name: 'T', duration: 5, tracks: [{ id: 'V1', kind: 'video' }], clips: [{ id: 'c', assetId: 'a', trackId: 'V1', startTime: 0, duration: 5, trimStart: 0, trimEnd: 0, speed: 1, volume: 1 }] };
    const state = buildPublishState(tl, [{ id: 'a', type: 'video', url: 'blob:http://x/1' } as any], [], 'x');
    expect(() => preparePublishProject(state, { title: 'x' })).toThrow(/uploaded/);
  });
});
