// [remix] runWorkflow routing: CineGen's generation calls land on MuAPI / OpenAI, never fal.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runTimelineMuapi = vi.fn();
const generateImages = vi.fn();
vi.mock('../../../lib/editor/ai/timelineMuapi.js', () => ({ runTimelineMuapi: (...a: unknown[]) => runTimelineMuapi(...a) }));
vi.mock('../../../lib/editor/ai/openaiImages.js', () => ({
  generateImages: (...a: unknown[]) => generateImages(...a),
  DEFAULT_IMAGE_MODEL: 'gpt-image-2.6-flare',
  DETAIL_IMAGE_MODEL: 'gpt-image-2.6-sunburst',
}));

import { runWorkflow } from '@cinegen/lib/cloud/funding';

beforeEach(() => {
  runTimelineMuapi.mockReset().mockResolvedValue({ url: 'https://cdn.test/out.mp4', urls: ['https://cdn.test/out.mp4'] });
  generateImages.mockReset().mockResolvedValue({ assets: [{ url: 'data:image/png;base64,AAA' }] });
});

describe('runWorkflow (web providers)', () => {
  it('Fill Gap -> MuAPI fill_gap with first/last frames', async () => {
    const out = await runWorkflow({ nodeId: 'timeline-fill-gap', nodeType: 'video', modelId: 'muapi:vidu-q2-turbo-start-end-video', inputs: { prompt: 'bridge', duration: '5', image_urls: ['https://a/1.jpg', 'https://a/2.jpg'] } }) as Record<string, unknown>;
    expect(runTimelineMuapi).toHaveBeenCalledWith('fill_gap', { model: 'vidu-q2-turbo-start-end-video', firstFrameUrl: 'https://a/1.jpg', lastFrameUrl: 'https://a/2.jpg', prompt: 'bridge', duration: 5 });
    expect(out.resultUrls).toEqual(['https://cdn.test/out.mp4']);
  });

  it('Extend after = image-to-video from the last frame; before = lead-in to the first frame', async () => {
    await runWorkflow({ nodeId: 'timeline-extend', nodeType: 'video', modelId: 'muapi:seedance-lite-i2v', inputs: { prompt: 'go on', duration: 5, image_urls: ['https://a/last.jpg'], direction: 'after' } });
    expect(runTimelineMuapi).toHaveBeenLastCalledWith('shot_video', { model: 'seedance-lite-i2v', imageUrl: 'https://a/last.jpg', prompt: 'go on', duration: 5 });
    await runWorkflow({ nodeId: 'timeline-extend', nodeType: 'video', modelId: 'muapi:vidu-q2-turbo-start-end-video', inputs: { prompt: 'lead in', duration: 5, image_urls: ['https://a/first.jpg'], direction: 'before' } });
    expect(runTimelineMuapi).toHaveBeenLastCalledWith('extend_before', { model: 'vidu-q2-turbo-start-end-video', firstFrameUrl: 'https://a/first.jpg', prompt: 'lead in', duration: 5 });
  });

  it('Music -> MuAPI music, returns audio.url', async () => {
    runTimelineMuapi.mockResolvedValue({ url: 'https://cdn.test/m.mp3', urls: ['https://cdn.test/m.mp3'] });
    const out = await runWorkflow({ nodeId: 'timeline-music', nodeType: 'music', modelId: 'muapi:suno-create-music', inputs: { prompt: 'epic', music_length_ms: 30000, force_instrumental: true } }) as { audio: { url: string } };
    expect(runTimelineMuapi).toHaveBeenCalledWith('music', { prompt: 'epic', duration: 30, instrumental: true });
    expect(out.audio.url).toBe('https://cdn.test/m.mp3');
  });

  it('Images -> OpenAI Images 2.6 (Sunburst when references are given)', async () => {
    await runWorkflow({ nodeId: 'n', nodeType: 'gpt-image-2.6-flare', modelId: 'x', outputType: 'image', inputs: { prompt: 'a cat', image_urls: ['https://a/ref.png'] } });
    expect(generateImages).toHaveBeenCalledWith('a cat', expect.objectContaining({ model: 'gpt-image-2.6-sunburst', refs: ['https://a/ref.png'] }));
    expect(runTimelineMuapi).not.toHaveBeenCalled();
  });

  it('a MuAPI catalog node -> generic generate tool', async () => {
    const out = await runWorkflow({ nodeId: 'n', nodeType: 'seedance-lite-t2v', modelId: 'seedance-lite-t2v', inputs: { prompt: 'a cat', duration: 5 } }) as { video: { url: string } };
    expect(runTimelineMuapi).toHaveBeenCalledWith('generate', { model: 'seedance-lite-t2v', inputs: { prompt: 'a cat', duration: 5 } });
    expect(out.video.url).toBe('https://cdn.test/out.mp4');
  });

  it('video tracking needs a video and a prompt (on-device tracker)', async () => {
    await expect(runWorkflow({ nodeId: 'n', nodeType: 'sam3-track-cloud', modelId: 'x', inputs: {} })).rejects.toThrow(/No video to track/i);
  });
});
