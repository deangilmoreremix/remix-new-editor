// [remix] Port I1. Word-timing resolution, overlap de-duplication, span planning and text joining adapted from FreeCut (MIT, Copyright (c) 2025 FreeCut,
// commit 5ceeeb388eef5423640b7db157706274bf1b8165): features/media-library/transcription/lib/{whisper-word-timings,chunker}.ts,
// workers/whisper.worker.ts (dedupeOverlappingWords) and shared/utils/transcript-text.ts. Re-expressed as pure functions (no workers/stores).

export interface RawWhisperWord { text: string; timestamp: [number | null, number | null]; confidence?: number }
export interface TranscriptWord { text: string; start: number; end: number; confidence?: number }

const FALLBACK_WORD_SECONDS = 0.5;
const MIN_WORD_SECONDS = 0.01;
const validTs = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function nextKnownStart(words: readonly RawWhisperWord[], index: number, after: number): number | null {
  for (let i = index + 1; i < words.length; i++) {
    const s = words[i]?.timestamp?.[0] ?? null;
    if (validTs(s) && s > after) return s;
  }
  return null;
}

/**
 * Whisper can leave the first or last word timestamp open at a decoding boundary. Keep the recognised text with a conservative inferred span
 * instead of dropping it. Times are seconds relative to the span; `spanStart` makes them absolute.
 */
export function resolveWhisperWordTimings(raw: readonly RawWhisperWord[], spanStart: number, spanDuration: number): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  let previousEnd = 0;
  raw.forEach((w, index) => {
    if (!String(w.text ?? '').trim()) return;
    const rs = w.timestamp?.[0] ?? null; const re = w.timestamp?.[1] ?? null;
    let start = validTs(rs) ? rs : validTs(re) ? Math.max(previousEnd, re - FALLBACK_WORD_SECONDS) : previousEnd;
    start = Math.min(Math.max(0, start), spanDuration);
    const nextStart = nextKnownStart(raw, index, start);
    let end: number | null = validTs(re) && re > start ? re : null;
    end ??= nextStart ?? Math.min(spanDuration, start + FALLBACK_WORD_SECONDS);
    if (end <= start && start === spanDuration && spanDuration > 0) { start = Math.max(0, spanDuration - MIN_WORD_SECONDS); end = spanDuration; }
    if (end <= start && start < spanDuration) end = Math.min(spanDuration, start + MIN_WORD_SECONDS);
    if (end <= start) return;
    previousEnd = end;
    out.push({ text: w.text, start: start + spanStart, end: end + spanStart, ...(typeof w.confidence === 'number' ? { confidence: w.confidence } : {}) });
  });
  return out;
}

const norm = (t: string) => t.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
const DUP_START_TOL = 0.5;
const RECENT_RETENTION = 8;

/** Drops words re-recognised inside the overlap between two spans (same normalised text and a close/overlapping start). Stateful across spans. */
export class OverlapDeduper {
  private recent: TranscriptWord[] = [];
  filter(words: TranscriptWord[]): TranscriptWord[] {
    const kept = words.filter((w) => {
      const n = norm(w.text);
      if (!n) return true;
      return !this.recent.some((r) => norm(r.text) === n && (Math.abs(r.start - w.start) <= DUP_START_TOL || (r.start < w.end && w.start < r.end)));
    });
    if (kept.length) {
      this.recent.push(...kept);
      const newest = kept[kept.length - 1].end;
      this.recent = this.recent.filter((r) => r.end >= newest - RECENT_RETENTION);
    }
    return kept;
  }
}

export const SAMPLE_RATE = 16_000;
export interface SpanPlan { startSample: number; endSample: number; startSec: number; final: boolean }
/**
 * Split `totalSamples` of 16 kHz audio into near-contiguous spans (default 120 s with 2 s overlap; transformers.js windows each span into 30 s pieces itself and
 * batches them). A trailing remainder no longer than the overlap is absorbed by the previous span.
 */
export function planSpans(totalSamples: number, spanSec = 120, overlapSec = 2): SpanPlan[] {
  const span = Math.round(spanSec * SAMPLE_RATE); const overlap = Math.round(overlapSec * SAMPLE_RATE); const advance = span - overlap;
  if (totalSamples <= 0) return [];
  const out: SpanPlan[] = [];
  let start = 0;
  while (true) {
    const end = Math.min(totalSamples, start + span);
    const rest = totalSamples - end;
    if (rest <= 0 || rest <= overlap) { out.push({ startSample: start, endSample: totalSamples, startSec: start / SAMPLE_RATE, final: true }); break; }
    out.push({ startSample: start, endSample: end, startSec: start / SAMPLE_RATE, final: false });
    start += advance;
  }
  return out;
}

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const NO_SPACE_BEFORE = /^[\p{P}\p{S}]/u;
const NO_SPACE_AFTER = /[\p{Ps}\p{Pi}]$/u;
const lastCh = (v: string) => Array.from(v.trim()).at(-1) ?? '';
const firstCh = (v: string) => Array.from(v.trim())[0] ?? '';
export function needsSeparator(prev: string, next: string): boolean {
  const a = lastCh(prev); const b = firstCh(next);
  if (!a || !b) return false;
  if (CJK.test(a) || CJK.test(b)) return false;
  return !NO_SPACE_AFTER.test(a) && !NO_SPACE_BEFORE.test(b);
}
export function joinWords(words: readonly string[]): string {
  const n = words.map((w) => w.trim()).filter(Boolean);
  return n.reduce((t, w, i) => (i === 0 ? w : `${t}${needsSeparator(n[i - 1], w) ? ' ' : ''}${w}`), '');
}
