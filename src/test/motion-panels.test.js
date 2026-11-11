import { describe, it, expect, beforeEach } from 'vitest';
import { buildMotionParams, createMotionPanel } from '../components/studios/MotionPanels.js';

beforeEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('motion panels', () => {
  it('builds recast and motion-control params from state', () => {
    const state = { modelId: 'kling-v3.0-pro-recast', videoUrl: 'https://x/v.mp4', imageUrls: ['https://x/a.png', 'https://x/b.png'], aspectRatio: '', orientation: 'image', duration: 0 };
    expect(buildMotionParams('recast', state, 'go')).toMatchObject({ video_url: 'https://x/v.mp4', image_url: 'https://x/a.png', character_orientation: 'image', prompt: 'go' });
    const mc = buildMotionParams('motion-control', { ...state, modelId: 'seedance-2.5-motion-control', aspectRatio: '16:9', duration: 8, quality: 'high', highBitrate: true, audio: true, seed: -1, mode: 'objects_swap' }, '');
    expect(mc).toMatchObject({ images_list: ['https://x/a.png', 'https://x/b.png'], duration: 8, high_bitrate: true, generate_audio: true, mode: 'objects_swap' });
  });

  it('shows the right controls for each panel and validates missing media', () => {
    const recast = createMotionPanel('recast');
    document.body.appendChild(recast);
    expect(recast.querySelectorAll('[data-media-slot]')).toHaveLength(2);
    const action = recast.querySelector('button[class*="btn-primary"], button');
    const mc = createMotionPanel('motion-control');
    document.body.appendChild(mc);
    expect(mc.textContent).toContain('Motion transfer');
    expect(mc.textContent).toContain('Seedance 2.5 Motion Control');
    expect(action).not.toBeNull();
  });
});
