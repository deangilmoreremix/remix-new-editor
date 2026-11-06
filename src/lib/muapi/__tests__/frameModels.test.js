import { describe, it, expect } from 'vitest';
import {
  buildFirstLastFramePayload,
  buildVideoExtendPayload,
  buildExtendBeforePayload,
  buildLayerPayload,
  buildWatermarkPayload,
  resultUrls,
  FIRST_LAST_FRAME_MODELS,
  DEFAULT_FILL_GAP_MODEL,
} from '../frameModels.js';

const A = 'https://cdn.example.com/a.jpg';
const B = 'https://cdn.example.com/b.jpg';

describe('MuAPI first/last frame payloads (Fill Gap)', () => {
  it('posts to the model\'s own endpoint, never a generic /image-to-video', () => {
    for (const id of Object.keys(FIRST_LAST_FRAME_MODELS)) {
      const { endpoint } = buildFirstLastFramePayload({ model: id, firstFrameUrl: A, lastFrameUrl: B });
      expect(endpoint).toBe(`/${id}`);
      expect(endpoint).not.toBe('/image-to-video');
    }
  });

  it('defaults to the cheap Vidu Q2 Turbo model with image_url + last_image', () => {
    const r = buildFirstLastFramePayload({ firstFrameUrl: A, lastFrameUrl: B, duration: 4 });
    expect(r.model).toBe(DEFAULT_FILL_GAP_MODEL);
    expect(r.endpoint).toBe('/vidu-q2-turbo-start-end-video');
    expect(r.payload).toMatchObject({ image_url: A, last_image: B, duration: 4 });
    expect(r.payload.prompt).toBeTruthy();
    expect(r.payload).not.toHaveProperty('first_frame_url');
  });

  it('uses images_list for Seedance first/last frame models', () => {
    const r = buildFirstLastFramePayload({ model: 'seedance-2.5-first-last-frame', firstFrameUrl: A, lastFrameUrl: B, prompt: 'walk' });
    expect(r.payload).toEqual({ prompt: 'walk', duration: 5, images_list: [A, B] });
  });

  it('uses end_image_url for Hailuo', () => {
    const r = buildFirstLastFramePayload({ model: 'minimax-hailuo-02-standard-i2v', firstFrameUrl: A, lastFrameUrl: B });
    expect(r.payload).toMatchObject({ image_url: A, end_image_url: B, duration: 6 });
  });

  it('reuses the one available frame for both ends', () => {
    const r = buildFirstLastFramePayload({ lastFrameUrl: B });
    expect(r.payload.image_url).toBe(B);
    expect(r.payload.last_image).toBe(B);
  });

  it('clamps duration to the model range', () => {
    expect(buildFirstLastFramePayload({ firstFrameUrl: A, duration: 99 }).payload.duration).toBe(8);
    expect(buildFirstLastFramePayload({ model: 'seedance-2.5-first-last-frame', firstFrameUrl: A, duration: 1 }).payload.duration).toBe(3);
  });

  it('rejects non-https frames and unknown models', () => {
    expect(() => buildFirstLastFramePayload({ firstFrameUrl: 'blob:abc' })).toThrow(/https/);
    expect(() => buildFirstLastFramePayload({ firstFrameUrl: 'data:image/png;base64,xx' })).toThrow(/https/);
    expect(() => buildFirstLastFramePayload({})).toThrow(/https/);
    expect(() => buildFirstLastFramePayload({ model: 'fal-ai/kling', firstFrameUrl: A })).toThrow(/Unsupported/);
  });
});

describe('other MuAPI payloads', () => {
  it('extend after sends the clip video to a video-extend model', () => {
    const r = buildVideoExtendPayload({ videoUrl: 'https://cdn.example.com/v.mp4', duration: 4 });
    expect(r.endpoint).toBe('/ltx-2.3-video-extend');
    expect(r.payload).toEqual({ video_url: 'https://cdn.example.com/v.mp4', duration: 4 });
    const w = buildVideoExtendPayload({ model: 'wan2.7-video-extend', videoUrl: 'https://cdn.example.com/v.mp4' });
    expect(w.payload.prompt).toBeTruthy();
  });

  it('extend before ends on the clip\'s first frame', () => {
    const r = buildExtendBeforePayload({ firstFrameUrl: A, duration: 3 });
    expect(r.payload.image_url).toBe(A);
    expect(r.payload.last_image).toBe(A);
  });

  it('layers use Seedream on MuAPI', () => {
    const r = buildLayerPayload({ imageUrl: A });
    expect(r.endpoint).toBe('/bytedance-seedream-5.0-pro-layer');
    expect(r.payload).toMatchObject({ image_url: A, output_format: 'png' });
    expect(r.payload.prompt).toBeTruthy();
  });

  it('watermark removal takes a video_url', () => {
    expect(buildWatermarkPayload({ videoUrl: 'https://cdn.example.com/v.mp4' })).toEqual({
      endpoint: '/video-watermark-remover', payload: { video_url: 'https://cdn.example.com/v.mp4' }, model: 'video-watermark-remover',
    });
  });

  it('collects every output url', () => {
    expect(resultUrls({ outputs: [A, B], url: A })).toEqual([A, B]);
    expect(resultUrls({ images: [{ url: A }] })).toEqual([A]);
    expect(resultUrls(null)).toEqual([]);
  });
});

describe('image → video (storyboard frames)', async () => {
  const { buildImageToVideoPayload } = await import('../frameModels.js');
  it('uses the model endpoint and snaps the duration', () => {
    const r = buildImageToVideoPayload({ imageUrl: 'https://cdn.example.com/f.png', prompt: 'slow push in', duration: 7 });
    expect(r).toEqual({ endpoint: '/seedance-lite-i2v', model: 'seedance-lite-i2v', payload: { image_url: 'https://cdn.example.com/f.png', prompt: 'slow push in', duration: 5 } });
    expect(buildImageToVideoPayload({ model: 'veo3.1-lite-image-to-video', imageUrl: 'https://x/y.png', duration: 9 }).payload.duration).toBe(8);
    expect(() => buildImageToVideoPayload({ imageUrl: 'data:x' })).toThrow(/https/);
  });
});
