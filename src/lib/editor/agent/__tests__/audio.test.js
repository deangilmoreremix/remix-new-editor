import { describe, it, expect, vi } from 'vitest';
import { generateAudio, duckingKeyframes, persistAudio } from '../audioGen.js';
import { createAgentTools, toolDefinitions } from '../tools.js';
import { valueAt } from '../../remotion/keyframes.js';
import { timelineToComposition } from '../../remotion/timelineToComposition.js';
import '../../addons/index.js';

const reply = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

const KEYS = { getMuapiKey: () => 'mu_test_key_0123456789', getOpenAIKey: () => 'sk-test0123456789abcdefghijkl' };
const KEYS_MUAPI_ONLY = { getMuapiKey: () => 'mu_test_key_0123456789', getOpenAIKey: () => null };
const NO_KEYS = { getMuapiKey: () => null, getOpenAIKey: () => null };

describe('audio generation client', () => {
  it('submits then polls until done', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(reply({ ok: true, requestId: 'req1' }))
      .mockResolvedValueOnce(reply({ ok: true, status: 'pending' }))
      .mockResolvedValueOnce(reply({ ok: true, status: 'done', url: 'https://cdn/a.mp3' }));
    const url = await generateAudio('tts', { text: 'Hi' }, { fetchImpl, pollMs: 1, keyManager: KEYS });
    expect(url).toBe('https://cdn/a.mp3');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ action: 'submit', kind: 'tts', text: 'Hi' });
    expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).toEqual({ action: 'status', requestId: 'req1' });
  });

  it('reports failures and missing config', async () => {
    await expect(generateAudio('music', { mood: 'calm' }, { fetchImpl: async () => reply({ ok: true, requestId: 'r' }), pollMs: 1, timeoutMs: 0, keyManager: KEYS })).rejects.toThrow(/timed out/);
    const failed = vi.fn().mockResolvedValueOnce(reply({ ok: true, requestId: 'r' })).mockResolvedValueOnce(reply({ ok: true, status: 'failed', error: 'nope' }));
    await expect(generateAudio('music', { mood: 'calm' }, { fetchImpl: failed, pollMs: 1, keyManager: KEYS })).rejects.toThrow('nope');
    // BYOK: without the user's key nothing is sent, and the message says where to add it.
    const never = vi.fn();
    await expect(generateAudio('tts', { text: 'x' }, { fetchImpl: never, keyManager: NO_KEYS })).rejects.toThrow(/Settings → API keys \(MuAPI/);
    await expect(generateAudio('tts', { text: 'x', provider: 'openai' }, { fetchImpl: never, keyManager: KEYS_MUAPI_ONLY })).rejects.toThrow(/OpenAI API Key/);
    expect(never).not.toHaveBeenCalled();
    // The server's own message (e.g. a rejected key) is shown as-is.
    await expect(generateAudio('tts', { text: 'x' }, { fetchImpl: async () => reply({ ok: false, error: { message: 'MuAPI rejected your API key' } }, 401), keyManager: KEYS })).rejects.toThrow(/rejected your API key/);
  });

  it('sends the user\'s keys as BYOK headers', async () => {
    const fetchImpl = vi.fn(async () => reply({ ok: true, status: 'done', url: 'https://x/a.mp3' }));
    await generateAudio('tts', { text: 'Hi' }, { fetchImpl, keyManager: KEYS });
    expect(fetchImpl.mock.calls[0][1].headers).toMatchObject({ 'X-MuAPI-Key': 'mu_test_key_0123456789', 'X-OpenAI-Key': 'sk-test0123456789abcdefghijkl' });
  });

  it('copies audio to storage, falling back to the provider URL', async () => {
    const fetchImpl = async () => ({ ok: true, blob: async () => new Blob(['x'], { type: 'audio/mpeg' }) });
    expect(await persistAudio('https://cdn/a.mp3', { upload: async (f) => { expect(f.name).toBe('voiceover.mp3'); return 'https://store/a.mp3'; }, name: 'voiceover', fetchImpl })).toBe('https://store/a.mp3');
    expect(await persistAudio('https://cdn/a.mp3', { upload: async () => { throw new Error('x'); }, fetchImpl })).toBe('https://cdn/a.mp3');
  });

  it('ducks music under voiceovers with fades', () => {
    const kfs = duckingKeyframes(0, 20, [[4, 10]]);
    expect(kfs[0]).toMatchObject({ t: 0, v: 0 });
    expect(kfs.at(-1)).toMatchObject({ t: 20, v: 0 });
    expect(valueAt(kfs, 2, 1)).toBeCloseTo(1, 1); // full volume before the voice
    expect(valueAt(kfs, 7, 1)).toBeCloseTo(0.35, 2); // ducked under it
    expect(valueAt(kfs, 15, 1)).toBeCloseTo(1, 1);
    const times = kfs.map((k) => k.t);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(new Set(times).size).toBe(times.length);
    expect(duckingKeyframes(5, 5, [])).toEqual([]);
  });
});

function fakeEditor() {
  const T = { v: 10 };
  const tracks = [
    { id: 'v', name: 'Main Video', type: 'video', items: [] },
    { id: 'a', name: 'Voiceover', type: 'audio', items: [] },
    { id: 't', name: 'Titles', type: 'text', items: [] },
  ];
  const times = new Map();
  const ed = {
    snapshot: () => ({ timelineSeconds: T.v, playheadSec: 0, tracks: tracks.map((t) => ({ ...t, clips: t.items })) }),
    setTimelineSeconds: vi.fn((s) => { T.v = s; }),
    ensureTrack: (name, type) => tracks.find((t) => t.name === name) || (tracks.push({ id: name, name, type, items: [] }), tracks.at(-1)),
    insertClip: (clip, kind) => {
      times.set(String(clip.id), { start: clip.start, end: clip.end });
      (tracks.find((t) => t.name === kind) || tracks.find((t) => t.type === kind)).items.push(clip);
      return clip;
    },
    getClip: (id) => tracks.flatMap((t) => t.items).find((c) => String(c.id) === String(id)) || null,
    clipTimes: (c) => times.get(String(c.id)),
    commit: vi.fn(),
    generateAudio: vi.fn(async (kind) => ({ url: `https://store/${kind}.mp3`, duration: kind === 'tts' ? 14 : 60 })),
  };
  return { ed, tracks, T };
}

describe('voiceover and music tools', () => {
  it('are defined with voices', () => {
    const vo = toolDefinitions().find((d) => d.name === 'add_voiceover');
    expect(vo.parameters.properties.voice.enum).toContain('Wise_Woman');
    expect(toolDefinitions().some((d) => d.name === 'add_music')).toBe(true);
  });

  it('adds a voiceover sized to the speech (growing the timeline) and ducked music', async () => {
    const { ed, tracks, T } = fakeEditor();
    const tools = createAgentTools(ed);
    const vo = JSON.parse((await tools.run('add_voiceover', { text: 'Fresh coffee, every morning.', voice: 'Calm_Woman', start: 1 })).content);
    expect(vo).toMatchObject({ seconds: 14, clip: { type: 'audio', start: 1, end: 15 } });
    expect(T.v).toBe(16); // grew to fit
    expect(ed.generateAudio).toHaveBeenCalledWith('tts', { text: 'Fresh coffee, every morning.', voice: 'Calm_Woman', speed: undefined });
    const music = JSON.parse((await tools.run('add_music', { mood: 'warm acoustic' })).content);
    expect(music).toMatchObject({ ducked: true, seconds: 16, clip: { type: 'audio', start: 0, end: 16 } });
    const musicClip = tracks.find((t) => t.name === 'Music').items[0];
    expect(musicClip).toMatchObject({ role: 'music', volume: 0.25 });
    expect(valueAt(musicClip.keyframes.volume, 8, 1)).toBeCloseTo(0.35, 2); // under the voiceover
    expect(ed.generateAudio.mock.calls[1]).toEqual(['music', { prompt: undefined, genre: undefined, mood: 'warm acoustic', duration: 16 }]);
    // A later voiceover re-ducks existing music.
    await tools.run('add_voiceover', { text: 'Second line', start: 0 });
    expect(valueAt(musicClip.keyframes.volume, 0.6, 1)).toBeLessThan(0.6);
    expect((await tools.run('add_voiceover', { text: '' })).ok).toBe(false);
    expect((await tools.run('add_music', {})).ok).toBe(false);
  });

  it('audio layers carry volume keyframes into the composition', () => {
    const state = { timelineSeconds: 10, tracks: [{ id: 'm', type: 'audio', items: [{ id: 'mu', type: 'audio', src: 'https://x/m.mp3', left: 0, width: 100, volume: 0.25, keyframes: { volume: [{ t: 0, v: 0 }, { t: 1, v: 1 }] } }] }] };
    const m = timelineToComposition(state, { fps: 30 });
    expect(m.audio[0]).toMatchObject({ kind: 'audio', volume: 0.25, keyframes: { volume: [{ t: 0, v: 0 }, { t: 1, v: 1 }] } });
  });
});
