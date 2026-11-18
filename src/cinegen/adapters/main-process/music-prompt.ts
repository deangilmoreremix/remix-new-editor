// [remix] CineGen's music prompt writer (electron/ipc/music-prompt.ts): same system prompt and user prompt,
// run on the OpenAI Responses API (user's own key) instead of fal any-llm.
import { responsesChat } from '../llm-responses';
import { toVisionImage } from './vision';

const SYSTEM_PROMPT = `You are a music prompt engineer. Your job is to write a detailed, evocative text prompt that will be used to generate music with an AI music model (ElevenLabs/Suno).

Your prompt should describe:
- The overall mood, energy, and emotional arc
- Instrumentation and arrangement
- Genre/style characteristics
- Tempo and rhythm feel
- Any specific musical elements (builds, drops, transitions)

Keep the prompt concise but vivid (2-4 sentences). Do NOT include timestamps or section markers. Write it as a continuous description.`;

interface MusicPromptParams {
  apiKey?: string;
  frameUrls?: string[];
  style?: string;
  genre?: string;
  mood?: string;
  tempo?: string;
  additionalNotes?: string;
}

function buildUserPrompt(params: MusicPromptParams, hasVideo: boolean): string {
  const parts: string[] = [];

  if (hasVideo) {
    parts.push('I have a video that needs a music soundtrack. I\'ve attached frames from the video for you to analyze.');
    parts.push('Look at the visual content, mood, pacing, and subject matter to inform the music style.');
  }

  const prefs: string[] = [];
  if (params.genre) prefs.push(`Genre: ${params.genre}`);
  if (params.style) prefs.push(`Style: ${params.style}`);
  if (params.mood) prefs.push(`Mood: ${params.mood}`);
  if (params.tempo) prefs.push(`Tempo: ${params.tempo}`);
  if (params.additionalNotes) prefs.push(`Notes: ${params.additionalNotes}`);

  if (prefs.length > 0) {
    parts.push('User preferences:\n' + prefs.join('\n'));
  }

  parts.push('Write a music generation prompt based on this context. Output ONLY the prompt text, nothing else.');

  return parts.join('\n\n');
}


export async function generateMusicPrompt(params: MusicPromptParams): Promise<{ prompt: string }> {
  const frames = (await Promise.all((params.frameUrls ?? []).slice(0, 6).map((u) => toVisionImage(u)))).filter((u): u is string => Boolean(u));
  const r = await responsesChat({ system: SYSTEM_PROMPT, user: buildUserPrompt(params, frames.length > 0), images: frames });
  return { prompt: r.message.trim() };
}
