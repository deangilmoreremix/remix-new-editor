// Converters from transcription results to the word-level Caption[] format the Remotion
// Recorder composition reads (@remotion/captions). Words carry a leading space, like
// Whisper.cpp output, because the composition joins captions by plain concatenation.
import type { Caption } from "@remotion/captions";

const toCaption = (text: string, startMs: number, endMs: number, confidence: number | null): Caption => ({
  text: ` ${text.trim()}`,
  startMs: Math.max(0, Math.round(startMs)),
  endMs: Math.max(0, Math.round(endMs)),
  timestampMs: Math.round((startMs + endMs) / 2),
  confidence,
});

/** transformers.js `return_timestamps: "word"` chunks: { text, timestamp: [startSec, endSec | null] } */
export const fromWordChunks = (
  chunks: { text: string; timestamp: [number, number | null] }[],
): Caption[] => {
  const out: Caption[] = [];
  chunks.forEach((chunk, i) => {
    if (!chunk.text.trim()) return;
    const start = chunk.timestamp[0] ?? 0;
    // The last word can come back without an end time: fall back to the next start (or +0.4s).
    const next = chunks[i + 1]?.timestamp[0];
    const end = chunk.timestamp[1] ?? next ?? start + 0.4;
    out.push(toCaption(chunk.text, start * 1000, Math.max(end, start) * 1000, null));
  });
  return out;
};

/** Whisper-service segments: [{ words: [{ word, start, end, confidence }] }] (seconds). */
export const fromServiceSegments = (
  segments: { words?: { word: string; start: number; end: number; confidence?: number }[] }[],
): Caption[] => {
  const out: Caption[] = [];
  for (const segment of segments) {
    for (const w of segment.words ?? []) {
      if (!w.word?.trim()) continue;
      out.push(toCaption(w.word, w.start * 1000, w.end * 1000, w.confidence ?? null));
    }
  }
  return out;
};

/** Plain SRT for a caption list, grouping words into short lines. */
export const captionsToSrt = (captions: Caption[], wordsPerLine = 7): string => {
  const ts = (ms: number) => {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    const r = Math.floor(ms % 1000);
    const p = (n: number, l = 2) => String(n).padStart(l, "0");
    return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
  };
  const lines: string[] = [];
  for (let i = 0, n = 1; i < captions.length; i += wordsPerLine, n++) {
    const group = captions.slice(i, i + wordsPerLine);
    const text = group.map((c) => c.text).join("").trim();
    lines.push(`${n}\n${ts(group[0]!.startMs)} --> ${ts(group[group.length - 1]!.endMs)}\n${text}\n`);
  }
  return lines.join("\n");
};
