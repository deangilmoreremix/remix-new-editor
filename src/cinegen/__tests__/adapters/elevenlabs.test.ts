// [remix] CineGen's ElevenLabs client served by MuAPI.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runTimelineMuapi = vi.fn();
const responsesChat = vi.fn();
vi.mock('../../../lib/editor/ai/timelineMuapi.js', () => ({ runTimelineMuapi: (...a: unknown[]) => runTimelineMuapi(...a) }));
vi.mock('../../../lib/apiKeyManager.js', () => ({ apiKeyManager: { getMuapiKey: () => 'mu_key' } }));
vi.mock('../../adapters/llm-responses', () => ({ responsesChat: (...a: unknown[]) => responsesChat(...a) }));

import { elevenLabs } from '@cinegen/lib/elevenlabs/client';
import { waitForElevenLabsAudio } from '@cinegen/lib/elevenlabs/wait';

beforeEach(() => { runTimelineMuapi.mockReset().mockResolvedValue({ url: 'https://cdn.test/a.mp3', urls: ['https://cdn.test/a.mp3'] }); responsesChat.mockReset(); });

describe('ElevenLabs on MuAPI', () => {
  it('is connected when the user has a MuAPI key and lists premade voices', async () => {
    expect(await elevenLabs.status()).toMatchObject({ connected: true });
    const { voices } = await elevenLabs.voices('rachel');
    expect(voices.map((v) => v.name)).toEqual(['Rachel']);
  });
  it('premade voice -> MuAPI elevenlabs-tts-turbo-2-5; the take completes', async () => {
    const take = await elevenLabs.generate({ requestId: 'r1', kind: 'speech', text: 'Hello there', voiceId: 'VOICE1' });
    expect(runTimelineMuapi).toHaveBeenCalledWith('generate', { model: 'elevenlabs-tts-turbo-2-5', inputs: { prompt: 'Hello there', voice_id: 'VOICE1' } }, expect.anything());
    expect((await waitForElevenLabsAudio(take)).url).toBe('https://cdn.test/a.mp3');
    expect((await elevenLabs.job('r1')).status).toBe('complete');
  });
  it('v4 voices -> elevenlabs-v4', async () => {
    await elevenLabs.generate({ requestId: 'r3', kind: 'speech', text: 'Hi', voiceId: 'voice_daniel' });
    expect(runTimelineMuapi.mock.calls[0][1].model).toBe('elevenlabs-v4');
  });
  it('sound -> Suno sound effects', async () => {
    await elevenLabs.generate({ requestId: 'r2', kind: 'sound', text: 'Thunder rolls' });
    expect(runTimelineMuapi.mock.calls[0][1].model).toBe('suno-generate-sounds');
  });
  it('the brief enhancer runs on OpenAI and keeps CineGen’s validation', async () => {
    responsesChat.mockResolvedValue({ message: JSON.stringify({ enhanced: 'A warm, close-up narrator voice, mid-30s, unhurried and reassuring.' }), usage: {} });
    const r = await elevenLabs.enhance({ requestId: 'e1', kind: 'voice', text: 'warm narrator' });
    expect(r).toMatchObject({ status: 'complete' });
  });
  it('voice design is reported as not offered and points to cloning', async () => {
    await expect(elevenLabs.design('a gravelly voice')).rejects.toThrow(/not offered.*clone/i);
  });
  it('MiniMax / Fish / Gemini voices route to their own MuAPI models', async () => {
    await elevenLabs.generate({ requestId: 'm1', kind: 'speech', text: 'Hi', voiceId: 'minimax:Friendly_Person', direction: 'happy' });
    expect(runTimelineMuapi.mock.calls[0][1]).toEqual({ model: 'minimax-speech-2.6-hd', inputs: { prompt: 'Hi', voice_id: 'Friendly_Person', emotion: 'happy', format: 'mp3' } });
    await elevenLabs.generate({ requestId: 'f1', kind: 'speech', text: 'Long text', voiceId: 'fish:voice_fish_narrator' });
    expect(runTimelineMuapi.mock.calls[1][1]).toEqual({ model: 'fish-s2-1-pro', inputs: { prompt: 'Long text', voice_id: 'voice_fish_narrator' } });
    await elevenLabs.generate({ requestId: 'g1', kind: 'speech', text: 'Hello', voiceId: 'gemini:Kore', direction: 'empathetic' });
    expect(runTimelineMuapi.mock.calls[2][1]).toEqual({ model: 'gemini-3-1-flash-tts', inputs: { speakers: [{ speaker_id: 'Speaker 1', voice_name: 'Kore', accent: 'Neutral', style: 'Empathetic', pace: 'Natural' }], dialogue_turns: [{ speaker_id: 'Speaker 1', text: 'Hello' }] } });
  });
  it('Gemini only sends a delivery style MuAPI accepts', async () => {
    await elevenLabs.generate({ requestId: 'g2', kind: 'speech', text: 'Hi', voiceId: 'gemini:Puck', direction: 'warm and friendly' });
    expect(runTimelineMuapi.mock.calls[0][1].inputs.speakers[0]).toEqual({ speaker_id: 'Speaker 1', voice_name: 'Puck', accent: 'Neutral', pace: 'Natural' });
  });
  it('lists the extra voices', async () => {
    const { voices } = await elevenLabs.voices('');
    expect(voices.map((v) => v.id)).toEqual(expect.arrayContaining(['minimax:Friendly_Person', 'fish:voice_fish_narrator', 'gemini:Kore', 'gemini:Puck']));
  });
  it('clone-based save voice: minimax-voice-clone, saved voice then speaks through MiniMax', async () => {
    localStorage.clear();
    const v = await elevenLabs.cloneVoice({ audioUrl: 'https://cdn.test/sample.mp3', name: 'Ava', sampleText: 'Testing one two' });
    expect(runTimelineMuapi.mock.calls[0][1]).toMatchObject({ model: 'minimax-voice-clone', inputs: { audio_url: 'https://cdn.test/sample.mp3', prompt: 'Testing one two', model: 'speech-2.6-hd' } });
    expect(v.id).toMatch(/^clone:Clone[a-z0-9]{8,}/);
    expect((await elevenLabs.voices('ava')).voices.map((x) => x.id)).toContain(v.id);
    await elevenLabs.generate({ requestId: 'c1', kind: 'speech', text: 'Hi', voiceId: v.id });
    expect(runTimelineMuapi.mock.calls[1][1]).toMatchObject({ model: 'minimax-speech-2.6-hd', inputs: { voice_id: v.id.slice(6) } });
    await expect(elevenLabs.cloneVoice({ audioUrl: '', name: 'x' })).rejects.toThrow(/audio sample/);
  });
});
