// [remix] Caption translation. The phrase grouping is OpenChatCut's own content-aware segmenter and the translation
// prompt/validation is copied from its captions/translate.ts (`translateLines`); the only change is that the model call
// goes through our OpenAI Responses adapter instead of their agent client, and the output is an .srt file.
import { segmentWords } from '../../../openchatcut/captions/segmenter';
import { responsesChat } from '../../adapters/llm-responses';

export interface TimedWord { text: string; startMs: number; endMs: number }
export interface Cue { startMs: number; endMs: number; text: string }

export const TRANSLATION_LANGUAGES = ['Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Hindi', 'Arabic', 'Russian', 'Turkish', 'English'] as const;

/** Group words into subtitle-length phrases (their segmenter), keeping each phrase's timing. */
export function phrasesFromWords(words: TimedWord[]): Cue[] {
  const clean = words.filter((w) => w.text.trim());
  if (!clean.length) return [];
  const starts = segmentWords(clean.map((w) => ({ text: w.text, start: w.startMs, end: w.endMs })), { wordsPerPage: 8, maxCharsPerLine: 48 });
  return starts.map((s, i) => {
    const slice = clean.slice(s, starts[i + 1] ?? clean.length);
    return { startMs: slice[0].startMs, endMs: slice[slice.length - 1].endMs, text: slice.map((w) => w.text).join(' ').replace(/\s+([,.!?;:])/g, '$1').trim() };
  }).filter((c) => c.text);
}

/** Their translateLines: numbered lines in, same count out, timing untouched. */
export async function translateLines(lines: string[], lang: string): Promise<string[]> {
  const numbered = lines.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const { message } = await responsesChat({
    system: `You are a subtitle translator. Translate each numbered line into ${lang}. Keep it natural and concise (subtitle length). Return ONLY a JSON array of strings — one per input line, same order and same count, no numbering, no extra prose.`,
    user: numbered,
  });
  const clean = String(message).trim().replace(/^\s*```[a-zA-Z]*\s*\n?/, '').replace(/\n?```\s*$/, '').trim();
  let arr: unknown;
  try { arr = JSON.parse(clean); } catch { arr = clean.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean); }
  if (!Array.isArray(arr)) throw new Error('translation did not return a list');
  return lines.map((_, i) => String(arr[i] ?? ''));
}

export async function translateCues(cues: Cue[], lang: string): Promise<Cue[]> {
  const out = await translateLines(cues.map((c) => c.text), lang);
  return cues.map((c, i) => ({ ...c, text: out[i] || c.text }));
}

const ts = (ms: number) => { const t = Math.max(0, Math.round(ms)); const p = (n: number, l = 2) => String(n).padStart(l, '0'); return `${p(Math.floor(t / 3600000))}:${p(Math.floor(t / 60000) % 60)}:${p(Math.floor(t / 1000) % 60)},${p(t % 1000, 3)}`; };
export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${ts(c.startMs)} --> ${ts(c.endMs)}\n${c.text}\n`).join('\n');
}
