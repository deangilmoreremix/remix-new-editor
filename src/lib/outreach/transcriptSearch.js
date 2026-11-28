// src/lib/outreach/transcriptSearch.js
//
// Search inside a video's transcript (requirements 17 and 33). Runs locally on the lines already in the page.
// A line is { startMs, endMs, text }. Every word you type must appear in the line (any order, any case).

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

/** The words of a query (empty when there is nothing to search). */
export const queryWords = (q) => norm(q).split(/[^\p{L}\p{N}']+/u).filter(Boolean);

/**
 * @returns {{ index:number, startMs:number, text:string, ranges:[number,number][] }[]}
 * `ranges` are [start, end) offsets in `text` of each matched word, to highlight.
 */
export function searchLines(lines, query, { limit = 50 } = {}) {
  const words = queryWords(query);
  if (!words.length) return [];
  const out = [];
  (Array.isArray(lines) ? lines : []).forEach((l, index) => {
    const text = String(l?.text ?? '');
    const hay = norm(text);
    if (!words.every((w) => hay.includes(w))) return;
    const ranges = [];
    for (const w of words) {
      let at = hay.indexOf(w);
      while (at !== -1) { ranges.push([at, at + w.length]); at = hay.indexOf(w, at + w.length); }
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) { const last = merged[merged.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]); }
    out.push({ index, startMs: Number(l.startMs) || 0, text, ranges: merged });
  });
  return out.slice(0, limit);
}

/** Split text into [{ text, hit }] pieces from `ranges`, so a caller can draw highlights without parsing HTML. */
export function highlightPieces(text, ranges) {
  const s = String(text ?? '');
  const parts = [];
  let at = 0;
  for (const [a, b] of ranges || []) {
    if (a > at) parts.push({ text: s.slice(at, a), hit: false });
    parts.push({ text: s.slice(a, b), hit: true });
    at = b;
  }
  if (at < s.length) parts.push({ text: s.slice(at), hit: false });
  return parts;
}

/**
 * The first match you can really jump to. Transcript times are in the original recording, but an edited video
 * (trims, cuts, added clips) plays on a different timeline: `remap(line)` returns the line as it is in the video
 * being played, or null when that part was cut out. Matches that were cut out are skipped.
 * @returns {{ index:number, startMs:number, text:string } | null}
 */
export function firstPlayableMatch(lines, query, remap = (l) => l) {
  for (const m of searchLines(lines, query, { limit: 400 })) {
    const line = remap(lines[m.index]);
    if (line && Number.isFinite(line.startMs)) return { index: m.index, startMs: Math.max(0, line.startMs), text: m.text };
  }
  return null;
}
