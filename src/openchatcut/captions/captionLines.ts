// [remix] Fix B4: deterministic line grouping of a caption page for the per-line motion presets (line-rise, line-fade). The preview and the export
// render the same page words, so the same greedy character budget (CAPTION_MAX_CHARS_PER_LINE, the estimate the paginator uses) gives the same
// lines in both. A line animates from the start of its first word; nothing depends on layout measurements, a clock or random numbers.
import { CAPTION_MAX_CHARS_PER_LINE } from './types';

/** Line index of every word, packing words greedily into lines of at most `maxChars` characters (a single longer word gets its own line). */
export function captionLineIndexes(words: ReadonlyArray<{ text: string }>, maxChars: number = CAPTION_MAX_CHARS_PER_LINE): number[] {
  const out: number[] = []; let line = 0; let used = 0;
  words.forEach((w, i) => {
    const len = Array.from(w.text.trim()).length;
    const need = used === 0 ? len : used + 1 + len;
    if (i > 0 && used > 0 && need > maxChars) { line++; used = len; } else used = need;
    out.push(line);
  });
  return out;
}

/** Start (ms) of the line each word is on: the start of that line's first word. */
export function captionLineStarts(words: ReadonlyArray<{ text: string; start: number }>, maxChars?: number): number[] {
  const idx = captionLineIndexes(words, maxChars); const starts: number[] = [];
  words.forEach((w, i) => { if (i === 0 || idx[i] !== idx[i - 1]) starts[idx[i]] = w.start; });
  return idx.map((l) => starts[l]);
}
