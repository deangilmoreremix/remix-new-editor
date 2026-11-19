/**
 * Template Generator — AI voiceover of the script.
 *
 * Two engines:
 *  - 'openai': the customer's OWN OpenAI key (Settings → API keys), through the app's audio endpoint. No platform key is ever used.
 *  - 'free':   Kokoro, running on the customer's device. No key, no cost; a ~90 MB model is downloaded the first time.
 * The audio is copied into the customer's storage (so it survives saving and exporting), and its real length is read.
 */
import { generateAudio, persistAudio, probeDuration, OPENAI_VOICES } from '../../../lib/editor/agent/audioGen.js';
import { uploadFileToStorage } from '../../../lib/uploadService.js';

export const VOICE_ENGINES = [['openai', 'My OpenAI key'], ['free', 'Free, on this device']];
export const OPENAI_VOICE_CHOICES = OPENAI_VOICES;
export const FREE_VOICE_CHOICES = [['af_heart', 'Heart — warm female'], ['af_bella', 'Bella — bright female'], ['am_michael', 'Michael — male'], ['bf_emma', 'Emma — British female']];
export const MAX_VOICE_CHARS = 1500;

/** What the voice reads: the script, one sentence after another. */
export function narrationText(text) {
  return String(text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).join(' ').slice(0, MAX_VOICE_CHARS);
}

const isDurable = (url) => typeof url === 'string' && !!url && !url.startsWith('blob:') && !url.startsWith('data:');

/**
 * @returns {Promise<{ url: string, duration: number, name: string, durable: boolean, engine: string }>}
 * `deps` lets tests replace the services.
 */
export async function makeVoiceover({ text, engine = 'openai', voice, speed = 1, instructions = '', onProgress, signal, deps = {} } = {}) {
  const say = narrationText(text);
  if (!say) throw new Error('Write or pick a script first. The voice reads it.');
  const upload = deps.upload || uploadFileToStorage;
  const probe = deps.probeDuration || probeDuration;
  const fallbackSeconds = Math.max(3, say.split(/\s+/).length * 0.4);

  if (engine === 'free') {
    const speakFree = deps.speakFree || (await import('../../../lib/editor/ml/localAI.js')).speakFree;
    const { wav, duration } = await speakFree(say, { voice: voice || 'af_heart', speed, onProgress, signal });
    const file = new File([wav], 'voiceover.wav', { type: 'audio/wav' });
    let url = '';
    try { const out = await upload(file); url = typeof out === 'string' ? out : out?.url || ''; } catch { url = ''; }
    const durable = isDurable(url);
    if (!durable) url = (deps.localUrl || ((b) => URL.createObjectURL(b)))(wav);          // session-only; the caller warns
    return { url, duration: duration || (await probe(url)) || fallbackSeconds, name: 'AI voiceover', durable, engine };
  }

  const generate = deps.generateAudio || generateAudio;
  const persist = deps.persistAudio || persistAudio;
  const remote = await generate('tts', { provider: 'openai', text: say, voice: voice || 'marin', speed, ...(instructions ? { instructions: String(instructions).slice(0, 500) } : {}) }, { signal, onProgress, ...(deps.keyManager ? { keyManager: deps.keyManager } : {}), ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) });
  // IMPORTANT: pass `upload`, otherwise the clip would carry the provider's huge data: URL into the project and the export.
  const url = await persist(remote, { upload, name: 'voiceover', ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) });
  return { url, duration: (await probe(url)) || fallbackSeconds, name: 'AI voiceover', durable: isDurable(url), engine };
}
