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
  it('voice design is reported as not offered', async () => {
    await expect(elevenLabs.design('a gravelly voice')).rejects.toThrow(/not offered/);
  });
});
