// [remix] Port I1: turn resolved Whisper words into the shapes CineGen already consumes: Remotion `Caption[]` (ms, leading space on each word but the first,
// as `chunksToCaptions` produces, so the existing caption styles and Stage 2 text-motion presets work unchanged) and transcript segments (seconds).
import { joinWords, type TranscriptWord } from './whisper-words';

export interface RemotionCaption { text: string; startMs: number; endMs: number; timestampMs: number; confidence: number | null }
export interface TranscriptSegment { start: number; end: number; text: string; words: Array<{ word: string; start: number; end: number }> }

export function wordsToCaptions(words: readonly TranscriptWord[]): RemotionCaption[] {
  return words.map((w, i) => {
    const startMs = Math.max(0, Math.round(w.start * 1000));
    const endMs = Math.max(startMs + 1, Math.round(w.end * 1000));
    return { text: (i ? ' ' : '') + w.text.trim(), startMs, endMs, timestampMs: Math.round((startMs + endMs) / 2), confidence: typeof w.confidence === 'number' ? w.confidence : null };
  });
}

/** Sentence-ish segments: break at sentence punctuation, a >0.8 s pause, or 18 words (same rules as the web adapter's toSegments). */
export function wordsToSegments(words: readonly TranscriptWord[], maxWords = 18, maxGapSec = 0.8): TranscriptSegment[] {
  const segs: TranscriptSegment[] = [];
  let cur: TranscriptSegment | null = null;
  for (const w of words) {
    const gap = cur ? w.start - cur.end : 0;
    if (!cur || gap > maxGapSec || cur.words.length >= maxWords || /[.!?。！？]$/.test(cur.text)) {
      cur = { start: w.start, end: w.end, text: w.text.trim(), words: [{ word: w.text.trim(), start: w.start, end: w.end }] };
      segs.push(cur);
    } else {
      cur.text = joinWords([cur.text, w.text]); cur.end = w.end; cur.words.push({ word: w.text.trim(), start: w.start, end: w.end });
    }
  }
  return segs;
}

export const wordsToText = (words: readonly TranscriptWord[]): string => joinWords(words.map((w) => w.text));
