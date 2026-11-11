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
// [remix] More MuAPI text-to-speech models (live catalog + MuAPI's text-to-speech page). Voice ids carry a prefix so one
// voice picker can address every model; only voices MuAPI documents are listed (MiniMax Friendly_Person, Fish
// voice_fish_narrator, Gemini Kore / Puck), plus the user's own cloned voices.
const MINIMAX_SPEECH = 'minimax-speech-2.6-hd';
const FISH_SPEECH = 'fish-s2-1-pro';
const GEMINI_SPEECH = 'gemini-3-1-flash-tts';
const MINIMAX_CLONE = 'minimax-voice-clone';
// Gemini TTS delivery styles accepted by MuAPI (its API rejects anything else).
const GEMINI_STYLES = ['Vocal Smile', 'Newscaster', 'Whisper', 'Empathetic', 'Promo/Hype', 'Deadpan'];
const MINIMAX_EMOTIONS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'];
const CLONED_KEY = 'remix.muapi.clonedVoices';
const loadCloned = (): ElevenLabsVoice[] => { try { return JSON.parse(localStorage.getItem(CLONED_KEY) || '[]'); } catch { return []; } };
const saveCloned = (v: ElevenLabsVoice[]) => { try { localStorage.setItem(CLONED_KEY, JSON.stringify(v)); } catch { /* storage blocked */ } };

/** Which MuAPI model + inputs speak this text in this voice. Exported for tests. */
export function speechRequest(text: string, voiceId: string | undefined, direction?: string): { model: string; inputs: Record<string, unknown> } {
  const prompt = direction ? `${direction}: ${text}` : text;
  const id = voiceId || '21m00Tcm4TlvDq8ikWAM';
  if (id.startsWith('minimax:') || id.startsWith('clone:')) {
    const emotion = direction && MINIMAX_EMOTIONS.includes(direction.toLowerCase()) ? direction.toLowerCase() : undefined;
    return { model: MINIMAX_SPEECH, inputs: { prompt: emotion ? text : prompt, voice_id: id.replace(/^(minimax|clone):/, ''), ...(emotion ? { emotion } : {}), format: 'mp3' } };
  }
  if (id.startsWith('fish:')) return { model: FISH_SPEECH, inputs: { prompt, voice_id: id.slice(5) } };
  if (id.startsWith('gemini:')) {
    const style = GEMINI_STYLES.find((x) => x.toLowerCase() === (direction || '').trim().toLowerCase());
    return { model: GEMINI_SPEECH, inputs: {
      speakers: [{ speaker_id: 'Speaker 1', voice_name: id.slice(7), accent: 'Neutral', ...(style ? { style } : {}), pace: 'Natural' }],
      dialogue_turns: [{ speaker_id: 'Speaker 1', text }],
    } };
  }
  return { model: V4_VOICES.has(id) ? SPEECH_MODEL_V4 : SPEECH_MODEL_PREMADE, inputs: { prompt, voice_id: id } };
}

/** ElevenLabs' public premade voices (MuAPI's ElevenLabs models take a voice_id). */
export const PREMADE_VOICES: ElevenLabsVoice[] = [
  { id: 'voice_daniel', name: 'Daniel', description: 'ElevenLabs v4 — clear male narrator' },
  { id: 'voice_liam', name: 'Liam', description: 'ElevenLabs v4 — warm male voice' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', description: 'Calm, young adult American female' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', description: 'Deep, narration-ready American male' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', description: 'Well-rounded, young adult male' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', description: 'Deep, young adult male' },
  { id: 'minimax:Friendly_Person', name: 'MiniMax — Friendly Person', description: 'MiniMax Speech 2.6 HD (multilingual, supports emotion)' },
  { id: 'fish:voice_fish_narrator', name: 'Fish — Narrator', description: 'Fish Audio S2.1 Pro, long-form narration' },
  { id: 'gemini:Kore', name: 'Gemini — Kore', description: 'Gemini 3.1 Flash TTS' },
  { id: 'gemini:Puck', name: 'Gemini — Puck', description: 'Gemini 3.1 Flash TTS' },
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
    case 'authLogin': case 'authStatus': case 'connect': case 'authCancel': case 'disconnect': {
      const connected = Boolean(apiKeyManager.getMuapiKey?.());
      if (!connected && (method === 'authLogin' || method === 'connect')) throw new Error('Add your MuAPI key in Settings → API Keys. ElevenLabs audio runs through it.');
      return { connected };
    }
    case 'voices': {
      const q = String((params as { search?: string } | undefined)?.search ?? '').trim().toLowerCase();
      return { voices: [...PREMADE_VOICES, ...loadCloned()].filter((v) => !q || `${v.name} ${v.description}`.toLowerCase().includes(q)) };
    }
    case 'generate': {
      const r = params as ElevenLabsAudioRequest;
      const text = String(r.text ?? '').trim();
      if (!text) throw new Error('Write the text to speak or the sound to make first.');
      const result: ElevenLabsAudioResult = { requestId: r.requestId, status: 'generating', assetId: `audio-${r.requestId}` };
      jobs.set(r.requestId, result);
      try {
        const req = r.kind === 'sound'
          ? { model: SOUND_MODEL, inputs: { prompt: [text, r.direction].filter(Boolean).join('. ') } }
          : speechRequest(text, r.voiceId, r.direction);
        const { url } = await runTimelineMuapi('generate', req, { timeoutMs: 5 * 60_000 });
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
    case 'cloneVoice': {
      // Clone-based "save voice": MuAPI has no model that designs a voice from a description, but it can clone one from a sample.
      const a = params as { audioUrl: string; name: string; sampleText?: string; description?: string };
      if (!a?.audioUrl) throw new Error('Add an audio sample of the voice first.');
      const customId = `Clone${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      const { url } = await runTimelineMuapi('generate', { model: MINIMAX_CLONE, inputs: { prompt: a.sampleText?.trim() || 'Hello, this is my cloned voice.', audio_url: a.audioUrl, custom_voice_id: customId, model: 'speech-2.6-hd' } }, { timeoutMs: 5 * 60_000 });
      const voice: ElevenLabsVoice = { id: `clone:${customId}`, name: a.name || 'Cloned voice', description: a.description || 'Cloned from your sample (MiniMax)', previewUrl: url };
      saveCloned([...loadCloned(), voice]);
      return voice;
    }
    case 'design': throw new Error('Designing a voice from a description is not offered by MuAPI. Upload an audio sample and use “Clone voice from sample” instead.');
    case 'saveVoice': throw new Error('Saving a designed voice is not offered. Use “Clone voice from sample”.');
    default: throw new Error(`Unknown audio request: ${method}`);
  }
}
