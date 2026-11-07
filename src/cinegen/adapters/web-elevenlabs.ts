// [remix] CineGen's ElevenLabs integration, on MuAPI (the user's own key). CineGen reaches ElevenLabs through its own
// cloud account; here the same client surface (`lib/elevenlabs/client.ts`) is served by MuAPI's ElevenLabs models
// (speech), Suno sound effects (sound) and the OpenAI Responses API (the brief enhancer).
// @ts-expect-error plain JS helpers from the main app
import { runTimelineMuapi } from '../../lib/editor/ai/timelineMuapi.js';
// @ts-expect-error plain JS key manager from the main app
import { apiKeyManager } from '../../lib/apiKeyManager.js';
import { responsesChat } from './llm-responses';
import { audioEnhancePrompt, enhancedAudioText, type AudioEnhanceKind } from '@cinegen/lib/elevenlabs/enhance-prompt';
import type { ElevenLabsAudioRequest, ElevenLabsAudioResult, ElevenLabsVoice } from '@cinegen/lib/elevenlabs/types';

// ElevenLabs v4 on MuAPI only accepts its own two voice ids; the public premade ids work on the turbo model.
const SPEECH_MODEL_PREMADE = 'elevenlabs-tts-turbo-2-5';
const SPEECH_MODEL_V4 = 'elevenlabs-v4';
const V4_VOICES = new Set(['voice_daniel', 'voice_liam']);
const SOUND_MODEL = 'suno-generate-sounds';

/** ElevenLabs' public premade voices (MuAPI's ElevenLabs models take a voice_id). */
export const PREMADE_VOICES: ElevenLabsVoice[] = [
  { id: 'voice_daniel', name: 'Daniel', description: 'ElevenLabs v4 — clear male narrator' },
  { id: 'voice_liam', name: 'Liam', description: 'ElevenLabs v4 — warm male voice' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, young adult American female' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, narration-ready American male' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Well-rounded, young adult male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep, young adult male' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', description: 'Crisp, middle-aged male' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', description: 'Strong, young adult female' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', description: 'Emotional, young adult female' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', description: 'Raspy, young adult male' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Soft, young adult female' },
];

const jobs = new Map<string, ElevenLabsAudioResult>();
const unavailable = (what: string) => new Error(`${what} is not offered through MuAPI yet.`);

export async function elevenLabsWeb(method: string, params?: unknown): Promise<unknown> {
  switch (method) {
    case 'accountStatus':
      return { connected: Boolean(apiKeyManager.getMuapiKey?.()), connection: 'api-key' };
    case 'authLogin': case 'authCancel': case 'authStatus': case 'connect': case 'disconnect':
      return { connected: Boolean(apiKeyManager.getMuapiKey?.()) };
    case 'voices': {
      const q = String((params as { search?: string } | undefined)?.search ?? '').trim().toLowerCase();
      return { voices: PREMADE_VOICES.filter((v) => !q || `${v.name} ${v.description}`.toLowerCase().includes(q)) };
    }
    case 'generate': {
      const r = params as ElevenLabsAudioRequest;
      const text = String(r.text ?? '').trim();
      if (!text) throw new Error('Write the text to speak or the sound to make first.');
      const result: ElevenLabsAudioResult = { requestId: r.requestId, status: 'generating', assetId: `audio-${r.requestId}` };
      jobs.set(r.requestId, result);
      try {
        const inputs = r.kind === 'sound'
          ? { prompt: [text, r.direction].filter(Boolean).join('. ') }
          : { prompt: r.direction ? `${r.direction}: ${text}` : text, voice_id: r.voiceId || '21m00Tcm4TlvDq8ikWAM' };
        const { url } = await runTimelineMuapi('generate', { model: r.kind === 'sound' ? SOUND_MODEL : V4_VOICES.has(String((inputs as { voice_id?: string }).voice_id)) ? SPEECH_MODEL_V4 : SPEECH_MODEL_PREMADE, inputs }, { timeoutMs: 5 * 60_000 });
        const done: ElevenLabsAudioResult = { ...result, status: 'complete', url };
        jobs.set(r.requestId, done);
        return done;
      } catch (error) {
        const failed: ElevenLabsAudioResult = { ...result, status: 'error', error: error instanceof Error ? error.message : String(error) };
        jobs.set(r.requestId, failed);
        throw error;
      }
    }
    case 'job': {
      const id = String((params as { requestId?: string } | undefined)?.requestId ?? '');
      const job = jobs.get(id);
      if (!job) throw new Error('This audio take is no longer available. Generate it again.');
      return job;
    }
    case 'enhance': {
      const a = params as { kind: AudioEnhanceKind; text: string; feedback?: string };
      const prompt = audioEnhancePrompt(a.kind, a.text, a.feedback ?? '');
      const r = await responsesChat({ system: prompt.system, user: prompt.user, json: true });
      let enhanced: unknown;
      try { enhanced = JSON.parse(r.message); } catch { return { status: 'error', error: 'The enhancer returned an unreadable answer. Your text is unchanged.' }; }
      return { status: 'complete', text: enhancedAudioText(enhanced, a.kind) };
    }
    case 'design': throw unavailable('Designing a voice');
    case 'saveVoice': throw unavailable('Saving a designed voice');
    default: throw new Error(`Unknown audio request: ${method}`);
  }
}
