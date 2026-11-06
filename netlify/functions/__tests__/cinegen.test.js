import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildToolRequest, normalizeResult, handle, TOOLS } from '../cinegen.js';

const key = 'mu_test_key_0123456789';
const submit = (tool, params, post, k = key, user = 'u') => handle({ action: 'submit', tool, params }, user, { key: k, post });

describe('cinegen function (AI Tools, BYOK)', () => {
  let post;
  beforeEach(() => { post = vi.fn(); });

  it('keeps the four tools that work and rejects the rest', async () => {
    expect(TOOLS).toEqual(['fill_gap', 'extend', 'element_create', 'shot_board']);
    for (const t of ['sam3_segment', 'layer_decompose', 'llm_chat', 'composition_plan', 'music_generation']) {
      expect((await submit(t, {}, post)).statusCode).toBe(400);
    }
    expect(post).not.toHaveBeenCalled();
  });

  it('needs the user\'s own MuAPI key, even when a platform key exists', async () => {
    process.env.MUAPI_API_KEY = 'platform-key';
    const res = await submit('fill_gap', { firstFrameUrl: 'https://x/a.jpg' }, post, null);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.code).toBe('need_key');
    expect(post).not.toHaveBeenCalled();
    delete process.env.MUAPI_API_KEY;
  });

  it('builds validated requests per tool', () => {
    expect(buildToolRequest('fill_gap', {}).error).toMatch(/start of the gap/);
    expect(buildToolRequest('fill_gap', { firstFrameUrl: 'javascript:alert(1)' }).error).toBeTruthy();
    expect(buildToolRequest('fill_gap', { firstFrameUrl: 'https://x/a.jpg', duration: 99 })).toMatchObject({ endpoint: '/image-to-video', payload: { first_frame_url: 'https://x/a.jpg', last_frame_url: 'https://x/a.jpg', duration: 15 } });
    expect(buildToolRequest('fill_gap', { firstFrameUrl: 'https://x/a.jpg', lastFrameUrl: 'https://x/b.jpg' }).payload.last_frame_url).toBe('https://x/b.jpg');
    expect(buildToolRequest('extend', { sourceFrameUrl: 'https://x/a.jpg', addedDuration: 0 }).payload).toMatchObject({ duration: 1, prompt_extend: true });
    expect(buildToolRequest('element_create', { prompt: ' ' }).error).toBeTruthy();
    expect(buildToolRequest('element_create', { prompt: 'a cup', aspect_ratio: '9:16' }).payload).toMatchObject({ model: 'flux-dev', aspect_ratio: '9:16' });
    expect(buildToolRequest('shot_board', { prompt: 'launch', count: 50, aspect_ratio: 'bogus' }).payload).toMatchObject({ n: 8, aspect_ratio: '16:9' });
  });

  it('submits on the user\'s key and returns a request id to poll', async () => {
    post.mockResolvedValueOnce({ request_id: 'req123' });
    const res = await submit('extend', { sourceFrameUrl: 'https://x/a.jpg' }, post);
    expect(JSON.parse(res.body)).toEqual({ ok: true, requestId: 'req123' });
    expect(post).toHaveBeenCalledWith('/image-to-video', expect.any(Object), undefined, key);
  });

  it('polls status and normalizes each tool\'s result; drops placeholder assets', async () => {
    const status = async (tool, data, params) => { post.mockResolvedValueOnce(data); return JSON.parse((await handle({ action: 'status', tool, requestId: 'req123', params }, 'u', { key, post })).body); };
    expect(await status('fill_gap', { status: 'processing' })).toEqual({ ok: true, status: 'pending' });
    expect(await status('fill_gap', { status: 'completed', outputs: ['https://cdn.muapi.ai/o.mp4'] }, { duration: 6 })).toMatchObject({ status: 'done', result: { success: true, tool: 'fill_gap', url: 'https://cdn.muapi.ai/o.mp4', duration: 6 } });
    expect(await status('extend', { status: 'success', outputs: ['https://cdn.muapi.ai/e.mp4'] })).toMatchObject({ result: { tool: 'extend', addedDuration: 5, direction: 'after' } });
    expect(await status('element_create', { status: 'completed', outputs: ['https://cdn.muapi.ai/i.png'] }, { prompt: 'a cup', name: 'Cup' })).toMatchObject({ result: { element: { name: 'Cup', url: 'https://cdn.muapi.ai/i.png' } } });
    const board = await status('shot_board', { status: 'completed', outputs: ['https://cdn.muapi.ai/1.png', 'https://cdn.muapi.ai/muapi/demo/x.png', 'https://cdn.muapi.ai/2.png'] });
    expect(board.result.urls).toEqual(['https://cdn.muapi.ai/1.png', 'https://cdn.muapi.ai/2.png']);
    expect(await status('fill_gap', { status: 'failed' })).toMatchObject({ status: 'failed' });
    expect(normalizeResult('fill_gap', { outputs: ['https://cdn.muapi.ai/muapi/demo/x.mp4'] }).success).toBe(false);
  });

  it('reports rejected keys and bad ids', async () => {
    post.mockRejectedValueOnce(Object.assign(new Error('nope'), { status: 401 }));
    expect(JSON.parse((await submit('element_create', { prompt: 'a cup' }, post, key, 'u-bad')).body).error.code).toBe('bad_key');
    expect((await handle({ action: 'status', tool: 'fill_gap', requestId: '../x' }, 'u', { key, post })).statusCode).toBe(400);
  });
});
