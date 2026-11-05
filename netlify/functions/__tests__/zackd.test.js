import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeBeats, parseJsonLoose, keyframePrompt, characterSheetPrompt, clipPrompt, ttsPayload, narrationText, totalDuration, allShots,
} from '../_shared/zackdPrompts.js';

const muapiPost = vi.fn();
vi.mock('../cinegenProviders.js', async (orig) => ({ ...(await orig()), muapiPost: (...a) => muapiPost(...a) }));
const { handle, buildSubmit } = await import('../zackd.js');

const llmMap = {
  title: 'Gum',
  beats: [
    { narration: 'Is gum stuck for 7 years?', hook: false, shots: [
      { type: 'wide', duration_sec: 9, scene_description: 'Boy swallows gum', camera_move: 'bogus', character_refs: ['Boy Sheet'], zoom_impact: false },
      { type: 'nope', duration_sec: 1, scene_description: 'Gum in esophagus', camera_move: 'tilt_down', character_refs: ['gut'], zoom_impact: true },
    ] },
    { narration: '', shots: [{ scene_description: 'dropped' }] },
    { narration: 'It passes in days.', shots: [{ scene_description: 'Relief', character_refs: ['gut'] }] },
  ],
  character_sheets: { boy_sheet: 'Boy in blue shirt', gut: 'Pink gut cutaway' },
};

describe('zackd prompts', () => {
  it('normalizes a beat map: ids, clamps, hook, sheets', () => {
    const map = normalizeBeats(llmMap, { topic: 'Gum' });
    expect(map.beats).toHaveLength(2);
    expect(map.beats[0].hook).toBe(true);
    expect(map.beats[1].hook).toBe(false);
    expect(map.beats[0].shots.map((s) => s.shot_id)).toEqual(['beat_1_a', 'beat_1_b']);
    expect(map.beats[0].shots[0].duration_sec).toBe(4);
    expect(map.beats[0].shots[1].duration_sec).toBe(2);
    expect(map.beats[0].shots[0].type).toBe('wide');
    expect(map.beats[0].shots[1].type).toBe('macro_cross_section');
    expect(map.beats[0].shots[0].camera_move).toBeTruthy();
    expect(map.character_sheets).toEqual([
      { id: 'boy_sheet', description: 'Boy in blue shirt' },
      { id: 'gut', description: 'Pink gut cutaway' },
    ]);
    expect(totalDuration(map)).toBe(allShots(map).reduce((n, s) => n + s.duration_sec, 0));
    expect(narrationText(map)).toBe('Is gum stuck for 7 years? It passes in days.');
  });

  it('rejects empty maps and parses fenced JSON', () => {
    expect(() => normalizeBeats({ beats: [] })).toThrow(/no usable beats/);
    expect(() => normalizeBeats(null)).toThrow();
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Sure! {"a":2} done')).toEqual({ a: 2 });
    expect(parseJsonLoose('nope')).toBeNull();
  });

  it('builds prompts with anchors, look and negatives', () => {
    const map = normalizeBeats(llmMap, { topic: 'Gum' });
    const p = keyframePrompt(map.beats[0].shots[0], map.character_sheets, { look: 'glass' });
    expect(p).toContain('Boy swallows gum');
    expect(p).toContain('boy sheet: Boy in blue shirt');
    expect(p).toContain('semi-translucent');
    expect(p).toContain('Avoid:');
    expect(characterSheetPrompt(map.character_sheets[1])).toContain('turnaround sheet');
    expect(clipPrompt({ camera_move: 'push_in', scene_description: 'X' })).toBe('Smooth 3D animation, camera movement push in. X');
    expect(ttsPayload({ text: ' hi ', voice: 'evil', speed: 9 })).toMatchObject({ text: 'hi', voice_id: 'Casual_Guy', speed: 2 });
  });
});

describe('zackd function', () => {
  const keys = { muapi: 'mu_test_key_0123456789', openai: 'sk-test_key_0123456789abcdef' };
  beforeEach(() => muapiPost.mockReset());
  const body = (r) => JSON.parse(r.body);

  it('validates submit requests', () => {
    expect(buildSubmit({ kind: 'image', prompt: 'x', aspect: '16:9' }).payload).toEqual({ prompt: 'x', aspect_ratio: '16:9' });
    expect(buildSubmit({ kind: 'image', prompt: 'x', aspect: 'weird' }).payload.aspect_ratio).toBe('9:16');
    expect(buildSubmit({ kind: 'image' }).error).toBeTruthy();
    expect(buildSubmit({ kind: 'clip', prompt: 'p', imageUrl: 'http://x.com/a.png' }).error).toMatch(/https/);
    expect(buildSubmit({ kind: 'clip', prompt: 'p', imageUrl: 'https://x.com/a.png' }).models[0]).toBe('veo3.1-fast-image-to-video');
    expect(buildSubmit({ kind: 'tts', text: 'x'.repeat(3001) }).error).toMatch(/too long/);
    expect(buildSubmit({ kind: 'music', duration: 999 }).payload.duration).toBe(180);
    expect(buildSubmit({ kind: 'video' }).error).toBeTruthy();
  });

  it('requires the right BYOK key per action', async () => {
    expect((await handle({ action: 'script', topic: 'x' }, 'u1', { keys: { muapi: keys.muapi } })).statusCode).toBe(401);
    expect(body(await handle({ action: 'submit', kind: 'image', prompt: 'x' }, 'u1', { keys: { openai: keys.openai } })).error.message).toMatch(/MuAPI/);
    expect((await handle({ action: 'nope' }, 'u1', { keys })).statusCode).toBe(400);
  });

  it('submits, falls back to the second model, and maps bad keys', async () => {
    muapiPost.mockResolvedValueOnce({ request_id: 'req_abc1' });
    expect(body(await handle({ action: 'submit', kind: 'image', prompt: 'x' }, 'u2', { keys }))).toMatchObject({ ok: true, requestId: 'req_abc1', model: 'nano-banana-2', attempt: 0, hasFallback: true });

    muapiPost.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 })).mockResolvedValueOnce({ request_id: 'req_def2' });
    expect(body(await handle({ action: 'submit', kind: 'image', prompt: 'x' }, 'u2', { keys }))).toMatchObject({ requestId: 'req_def2', model: 'flux-dev-image', attempt: 1, hasFallback: false });
    expect(muapiPost.mock.calls.at(-2)[0]).toBe('/nano-banana-2');

    muapiPost.mockRejectedValueOnce(Object.assign(new Error('no'), { status: 402 }));
    expect((await handle({ action: 'submit', kind: 'tts', text: 'hi' }, 'u2', { keys })).statusCode).toBe(401);
  });

  it('reports status via GET and rejects bad request ids', async () => {
    expect(body(await handle({ action: 'status', requestId: '!!' }, 'u3', { keys })).error.code).toBe('bad_request');
    const reply = (data, status = 200) => vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => data });
    let f = reply({ status: 'processing' });
    expect(body(await handle({ action: 'status', requestId: 'req_abc1' }, 'u3', { keys, fetchImpl: f }))).toEqual({ ok: true, status: 'pending' });
    expect(f.mock.calls[0][0]).toBe('https://api.muapi.ai/api/v1/predictions/req_abc1/result');
    expect(f.mock.calls[0][1]).toEqual({ headers: { 'x-api-key': keys.muapi } }); // GET: no method/body
    expect(body(await handle({ action: 'status', requestId: 'req_abc1' }, 'u3', { keys, fetchImpl: reply({ status: 'failed' }) })).status).toBe('failed');
    expect(body(await handle({ action: 'status', requestId: 'req_abc1' }, 'u3', { keys, fetchImpl: reply({ status: 'completed', outputs: ['https://cdn.example.com/a.mp4'] }) }))).toEqual({ ok: true, status: 'done', url: 'https://cdn.example.com/a.mp4' });
    // sandbox/static placeholder assets are never reported as generated output
    const stub = reply({ status: 'completed', outputs: ['https://d3adwkbyhxyrtq.cloudfront.net/webassets/videomodels/nano-banana-2.0.avif'] });
    expect(body(await handle({ action: 'status', requestId: 'req_abc1' }, 'u3', { keys, fetchImpl: stub })).status).toBe('failed');
    expect(body(await handle({ action: 'status', requestId: 'req_abc1' }, 'u3', { keys, fetchImpl: reply({}, 404) })).status).toBe('failed');
    expect(body(await handle({ action: 'status', requestId: 'req_abc1' }, 'u3', { keys, fetchImpl: reply({}, 503) })).status).toBe('pending');
    expect((await handle({ action: 'status', requestId: 'req_abc1' }, 'u3', { keys, fetchImpl: reply({}, 401) })).statusCode).toBe(401);
  });

  it('script action normalizes the LLM answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: JSON.stringify(llmMap) }) });
    const out = body(await handle({ action: 'script', topic: 'Gum' }, 'u4', { keys, fetchImpl }));
    expect(out.ok).toBe(true);
    expect(out.map.beats).toHaveLength(2);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${keys.openai}`);

    const bad = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const r = await handle({ action: 'script', topic: 'Gum' }, 'u4', { keys, fetchImpl: bad });
    expect(r.statusCode).toBe(401);
  });
});
