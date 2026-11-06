import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTimelineAITool, TIMELINE_AI_TOOLS, NEED_KEY_MESSAGE } from '../../aiToolsClient.js';
import { openAiToolsWindow, summarizeResult } from '../aiTools.js';
import { sourceTimeFor } from '../frameCapture.js';

const KEYS = { getMuapiKey: () => 'mu_test_key_0123456789' };
const reply = (body, status = 200) => new Response(JSON.stringify(body), { status });

describe('AI Tools client (BYOK, polls the job)', () => {
  it('sends the user\'s key, submits, then polls to the result', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply({ ok: true, requestId: 'r1' }))
      .mockResolvedValueOnce(reply({ ok: true, status: 'pending' }))
      .mockResolvedValueOnce(reply({ ok: true, status: 'done', result: { success: true, tool: 'fill_gap', url: 'https://x/o.mp4' } }));
    const out = await runTimelineAITool('fill_gap', { firstFrameUrl: 'https://x/a.jpg' }, { fetchImpl, keyManager: KEYS, pollMs: 1 });
    expect(out).toMatchObject({ success: true, url: 'https://x/o.mp4' });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/cinegen');
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({ 'X-MuAPI-Key': 'mu_test_key_0123456789' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({ action: 'submit', tool: 'fill_gap' });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toMatchObject({ action: 'status', requestId: 'r1' });
  });

  it('finishes straight away when the job is already done', async () => {
    const fetchImpl = vi.fn(async () => reply({ ok: true, status: 'done', result: { success: true, tool: 'element_create', url: 'https://x/i.png' } }));
    expect((await runTimelineAITool('element_create', { prompt: 'a cup' }, { fetchImpl, keyManager: KEYS })).url).toBe('https://x/i.png');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('asks for a key before sending anything, and explains failures', async () => {
    const never = vi.fn();
    const noKey = await runTimelineAITool('extend', {}, { fetchImpl: never, keyManager: { getMuapiKey: () => null } });
    expect(noKey).toMatchObject({ success: false, code: 'need_key', error: NEED_KEY_MESSAGE });
    expect(never).not.toHaveBeenCalled();
    expect((await runTimelineAITool('sam3_segment', {}, { fetchImpl: never, keyManager: KEYS })).success).toBe(false);
    const rejected = await runTimelineAITool('extend', {}, { fetchImpl: async () => reply({ ok: false, error: { message: 'MuAPI rejected your API key' } }, 401), keyManager: KEYS });
    expect(rejected).toMatchObject({ success: false, error: expect.stringMatching(/rejected your API key/) });
    const failed = await runTimelineAITool('extend', {}, { fetchImpl: vi.fn().mockResolvedValueOnce(reply({ ok: true, requestId: 'r' })).mockResolvedValueOnce(reply({ ok: true, status: 'failed', error: 'could not' })), keyManager: KEYS, pollMs: 1 });
    expect(failed).toMatchObject({ success: false, error: 'could not' });
  });

  it('times out instead of polling forever', async () => {
    const fetchImpl = vi.fn(async (_u, init) => reply(JSON.parse(init.body).action === 'submit' ? { ok: true, requestId: 'r' } : { ok: true, status: 'pending' }));
    expect((await runTimelineAITool('extend', {}, { fetchImpl, keyManager: KEYS, pollMs: 1, timeoutMs: 5 })).error).toMatch(/taking too long/);
  });
});

describe('AI Tools window', () => {
  let s;
  const selected = { id: 'c1', src: 'https://x/a.mp4', type: 'video', name: 'Clip A', durationSec: 4, trimIn: 1 };
  const next = { id: 'c2', src: 'https://x/b.mp4', type: 'video', name: 'Clip B', durationSec: 3, trimIn: 0 };
  beforeEach(() => {
    document.body.innerHTML = '';
    s = {
      hasKey: () => true, getSelected: () => selected, getNext: () => next,
      captureFrame: vi.fn(async (clip, which) => `https://frames/${clip.id}-${which}.jpg`),
      upload: vi.fn(async (f) => `https://up/${f.name}`),
      run: vi.fn(async (tool) => (tool === 'shot_board' ? { success: true, tool, urls: ['https://i/1.png', 'https://i/2.png'], count: 2 } : tool === 'element_create' ? { success: true, tool, url: 'https://i/e.png', element: { name: 'Element' } } : { success: true, tool, url: 'https://v/o.mp4', duration: 6 })),
      addToTimeline: vi.fn(), addToLibrary: vi.fn(), record: vi.fn(), toast: vi.fn(),
    };
  });
  const click = (el, sel) => el.querySelector(sel).click();
  const type = (el, sel, v) => { const t = el.querySelector(sel); t.value = v; t.dispatchEvent(new Event('input', { bubbles: true })); };
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('Fill Gap: frames from the selected and next clips, then the clip goes after the selected one', async () => {
    const w = openAiToolsWindow(s);
    expect(w.el.querySelectorAll('[data-tool]')).toHaveLength(4);
    click(w.el, '[data-act="generate"]');
    expect(w.el.querySelector('.speech-modal__errors').textContent).toMatch(/start frame/);
    click(w.el, '[data-frame="first"][data-act="end-of-selected"]');
    await vi.waitFor(() => expect(w.ui.frames.first?.url).toBe('https://frames/c1-end.jpg'));
    click(w.el, '[data-frame="last"][data-act="start-of-next"]');
    await vi.waitFor(() => expect(w.ui.frames.last?.url).toBe('https://frames/c2-start.jpg'));
    type(w.el, '[data-k="prompt"]', 'camera drifts');
    click(w.el, '[data-act="generate"]');
    await vi.waitFor(() => expect(w.el.querySelector('.aitool-result video')).toBeTruthy());
    expect(s.run).toHaveBeenCalledWith('fill_gap', { firstFrameUrl: 'https://frames/c1-end.jpg', lastFrameUrl: 'https://frames/c2-start.jpg', prompt: 'camera drifts', duration: 5 }, expect.any(Object));
    expect(s.record).toHaveBeenCalled();
    click(w.el, '[data-add="0"]');
    expect(s.addToTimeline).toHaveBeenCalledWith({ kind: 'video', src: 'https://v/o.mp4', name: 'Fill Gap', durationSec: 6, after: 'selected' });
    w.close();
  });

  it('Extend uses an uploaded image; Element and Shot Board need a description', async () => {
    const w = openAiToolsWindow(s, { tool: 'extend' });
    const input = w.el.querySelector('[data-upload="source"]');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'last.jpg')] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(w.ui.frames.source?.url).toBe('https://up/last.jpg'));
    w.setTool('element_create');
    click(w.el, '[data-act="generate"]');
    expect(s.run).not.toHaveBeenCalled();
    expect(w.el.querySelector('.speech-modal__errors').textContent).toMatch(/Describe the image/);
    type(w.el, '[data-k="prompt"]', 'a glass of coffee');
    click(w.el, '[data-act="generate"]');
    await vi.waitFor(() => expect(w.el.querySelector('.aitool-result img')).toBeTruthy());
    click(w.el, '[data-lib]');
    expect(s.addToLibrary).toHaveBeenCalledWith({ src: 'https://i/e.png', label: 'Element', type: 'image' });
    w.close();
  });

  it('Shot Board: several shots, add one or all; missing key is explained; Esc closes', async () => {
    const w = openAiToolsWindow(s, { tool: 'shot_board' });
    type(w.el, '[data-k="prompt"]', 'a launch day');
    click(w.el, '[data-act="generate"]');
    await vi.waitFor(() => expect(w.el.querySelectorAll('.aitool-shot')).toHaveLength(2));
    expect(s.run.mock.calls[0][1]).toMatchObject({ prompt: 'a launch day', count: 4, style: 'cinematic', aspect_ratio: '16:9' });
    click(w.el, '[data-add="all"]');
    expect(s.addToTimeline).toHaveBeenCalledTimes(2);
    expect(s.addToTimeline.mock.calls[1][0]).toMatchObject({ kind: 'image', after: 'previous' });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.speech-modal')).toBeNull();
    const noKey = openAiToolsWindow({ ...s, hasKey: () => false });
    expect(noKey.el.querySelector('.speech-modal__key').textContent).toMatch(/MuAPI key/);
    noKey.close();
  });

  it('summaries and frame times', () => {
    expect(summarizeResult({ success: true, tool: 'shot_board', count: 3 })).toBe('3 shots');
    expect(summarizeResult({ success: false, error: 'Nope' })).toBe('Nope');
    expect(sourceTimeFor(selected, 'end')).toBeCloseTo(4.9);
    expect(sourceTimeFor(selected, 'start')).toBe(1);
    expect(Object.values(TIMELINE_AI_TOOLS)).toHaveLength(4);
  });
});
