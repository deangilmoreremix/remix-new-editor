import { describe, it, expect, vi } from 'vitest';
import { validateSpeech, speechRequest, ttsMeta, previewLine, renderSmartSpeech, saveVoice, loadSavedVoices, LIMIT, PERSONAL_LIMIT } from '../smartSpeech.js';
import { tokensForLine, fetchPersonalVoice, usesAiVoice } from '../../publish/personalVoice.js';
import { createInteractivePlayer } from '../../publish/interactivePlayer.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

describe('Smart Speech', () => {
  it('enforces upstream limits (150, 70 personalized) and a fallback', () => {
    const base = { provider: 'minimax', voice: 'Wise_Woman', speed: 1 };
    expect(validateSpeech({ ...base, text: 'x'.repeat(LIMIT) })).toEqual([]);
    expect(validateSpeech({ ...base, text: 'x'.repeat(LIMIT + 1) })[0]).toMatch(/150/);
    expect(validateSpeech({ ...base, text: `Hi {{firstname}} ${'x'.repeat(PERSONAL_LIMIT)}`, fallback: 'Hi' })[0]).toMatch(/70/);
    expect(validateSpeech({ ...base, text: 'Hi {{firstname}}' })[0]).toMatch(/fallback/);
    expect(validateSpeech({ ...base, text: 'Hi {{firstname}}', fallback: 'Hi {{company}}' })[0]).toMatch(/can’t contain/);
  });

  it('builds provider-specific requests and clip metadata', () => {
    expect(speechRequest({ provider: 'minimax', voice: 'Calm_Woman', speed: 3, pitch: 4 }, 'Hi')).toEqual({ provider: 'minimax', text: 'Hi', voice: 'Calm_Woman', speed: 2, pitch: 4 });
    expect(speechRequest({ provider: 'openai', voice: 'Calm_Woman', speed: 3, instructions: ' warm ' }, 'Hi')).toEqual({ provider: 'openai', text: 'Hi', voice: 'marin', speed: 3, instructions: 'warm' });
    expect(ttsMeta({ provider: 'openai', voice: 'cedar', speed: 1, text: 'Hi {{firstname}}', fallback: 'Hi there' })).toMatchObject({ provider: 'openai', voice: 'cedar', text: 'Hi {{firstname}}', fallback: 'Hi there', personalized: true });
    expect(previewLine({ text: 'Hi {{firstname}}', fallback: 'Hi there' }, () => 'Hi Ann')).toBe('Hi Ann');
    expect(previewLine({ text: 'Hi {{firstname}}', fallback: 'Hi there' }, (t) => t)).toBe('Hi there');
  });

  it('saves voices', () => {
    const storage = memory();
    saveVoice({ name: 'Narrator', provider: 'openai', voice: 'cedar', speed: 1.1 }, storage);
    expect(loadSavedVoices(storage)).toEqual([{ name: 'Narrator', provider: 'openai', voice: 'cedar', speed: 1.1 }]);
  });

  it('the panel adds the fallback audio with tts metadata for personalized lines', async () => {
    const el = document.createElement('div');
    const generate = vi.fn(async (req) => ({ url: `https://a/${encodeURIComponent(req.text)}.mp3`, duration: 2 }));
    const add = vi.fn();
    renderSmartSpeech(el, { generate, add, storage: memory(), resolveTokens: () => 'Hi Ann' });
    const ta = el.querySelector('[data-k="text"]');
    ta.value = 'Hi {{firstname}}';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    const fb = el.querySelector('[data-k="fallback"]');
    expect(fb).toBeTruthy();
    fb.value = 'Hi there';
    fb.dispatchEvent(new Event('input', { bubbles: true }));
    el.querySelector('[data-act="add"]').click();
    await vi.waitFor(() => expect(add).toHaveBeenCalled());
    expect(generate.mock.calls[0][0].text).toBe('Hi there');
    expect(add.mock.calls[0][0]).toMatchObject({ url: 'https://a/Hi%20there.mp3', duration: 2, tts: { personalized: true, text: 'Hi {{firstname}}', fallback: 'Hi there' } });
  });
});

describe('personalized voice on /watch', () => {
  it('needs every token unless it has a default', () => {
    expect(tokensForLine('Hi {{firstname}}', { variables: { FirstName: 'Ann' } })).toEqual({ firstname: 'Ann' });
    expect(tokensForLine('Hi {{firstname}}', { variables: {} })).toBeNull();
    expect(tokensForLine('Hi {{d firstname "friend"}}', null)).toEqual({});
  });

  it('polls watch-voice and gives up quietly', async () => {
    const clip = { id: 's1', tts: { personalized: true, text: 'Hi {{firstname}}' } };
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, requestId: 'r1', cacheKey: 'k' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, status: 'done', url: 'https://cdn/a.mp3' })));
    expect(await fetchPersonalVoice({ publishedId: 'abcd1234', clip, profile: { variables: { firstname: 'Ann' } } }, { fetchImpl, pollMs: 1 })).toBe('https://cdn/a.mp3');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ action: 'submit', publishedId: 'abcd1234', clipId: 's1', tokens: { firstname: 'Ann' } });
    expect(await fetchPersonalVoice({ publishedId: 'abcd1234', clip, profile: null }, { fetchImpl })).toBeNull();
    const failing = vi.fn(async () => new Response('{}', { status: 422 }));
    expect(await fetchPersonalVoice({ publishedId: 'abcd1234', clip, profile: { variables: { firstname: 'Ann' } } }, { fetchImpl: failing })).toBeNull();
    expect(usesAiVoice({ tracks: [{ items: [clip] }] })).toBe(true);
  });

  it('the player swaps in the viewer’s line when it arrives', async () => {
    const updates = [];
    const engine = { play() {}, pause() {}, seekToFrame() {}, update: (m) => updates.push(m), destroy() {} };
    const project = { timelineSeconds: 10, tracks: [{ type: 'audio', name: 'Voiceover', items: [{ id: 's1', type: 'audio', src: 'https://x/fallback.mp3', start: 0, end: 2, tts: { personalized: true, text: 'Hi {{firstname}}' } }] }] };
    const frame = document.createElement('div');
    const player = createInteractivePlayer({ project, stage: document.createElement('div'), frame, createEngine: () => engine, profile: { variables: { firstname: 'Ann' } }, voiceFor: async () => 'https://cdn/ann.mp3' });
    expect(player.model.audio?.[0]?.src ?? JSON.stringify(player.model)).toContain('fallback.mp3');
    await vi.waitFor(() => expect(updates.length).toBe(1));
    expect(JSON.stringify(updates[0])).toContain('https://cdn/ann.mp3');
    player.destroy();
  });
});
