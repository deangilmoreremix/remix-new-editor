// [remix] Caption timeline lane operations on a CineGen clip's captions. OpenChatCut's lane (captions/CaptionTrackLane.tsx) works on its own
// TimelineState; here the same interactions (select, multi-select, group move, trim, copy/paste, delete, snap) act on `clip.captions`
// through their cue model (captionCues.buildCues / cueTextPatch) and stable word identities, and the result is saved as ordinary clip state.
import type { Clip } from '@cinegen/types/timeline';
import { buildCues, cueTextPatch } from '../../../openchatcut/captions/captionCues';
import { backfillCueIdentities } from '../../../openchatcut/transcript/identity';
import type { CaptionsData } from '../../../openchatcut/captions/types';

export const LANE_FPS = 30;
const MIN_CUE_MS = 120;

export interface LaneCue { key: string; clipId: string; start: number; end: number; text: string; idx: number[]; refs: string[] }
type Words = NonNullable<CaptionsData['words']>;

export const clipCaptions = (c: Clip): CaptionsData | undefined => (c.captions && c.captions.enabled !== false && c.captions.words?.length ? c.captions : undefined);

/** Cues as the renderer pages them (so the lane shows what the viewer sees), in timeline milliseconds. */
export function laneCues(clips: Clip[]): LaneCue[] {
  const out: LaneCue[] = [];
  for (const c of clips) {
    const caps = clipCaptions(c);
    if (!caps) continue;
    for (const row of buildCues(caps, [], LANE_FPS)) {
      if (!row.srcIdxs.length) continue;
      out.push({ key: `${c.id}:${row.wordRefs[0] || row.srcIdxs[0]}`, clipId: c.id, start: row.start, end: row.end, text: row.text, idx: row.srcIdxs, refs: row.wordRefs });
    }
  }
  return out;
}

const words = (caps: CaptionsData): Words => [...(caps.words ?? [])] as Words;
const sortByStart = (w: Words): Words => [...w].sort((a, b) => a.start - b.start || a.end - b.end);

/** Move the cues' words by `deltaMs` (group move: every selected cue shifts by the same amount). */
export function moveCues(caps: CaptionsData, cues: LaneCue[], deltaMs: number): CaptionsData {
  const w = words(caps); const ids = new Set(cues.flatMap((c) => c.refs));
  const idxs = new Set(cues.flatMap((c) => c.idx));
  const minStart = Math.min(...[...idxs].map((i) => w[i]?.start ?? Infinity));
  const d = Math.max(deltaMs, -minStart);                 // never before 0
  void ids;
  idxs.forEach((i) => { if (w[i]) w[i] = { ...w[i], start: Math.round(w[i].start + d), end: Math.round(w[i].end + d) }; });
  return { ...caps, words: sortByStart(w) };
}

/** Trim a cue's start or end (only the first/last word's edge moves, so the text keeps its timing). */
export function trimCue(caps: CaptionsData, cue: LaneCue, edge: 'start' | 'end', deltaMs: number): CaptionsData {
  const w = words(caps);
  const i = edge === 'start' ? cue.idx[0] : cue.idx[cue.idx.length - 1];
  const word = w[i]; if (!word) return caps;
  if (edge === 'start') { const limit = (cue.idx.length === 1 ? word.end : w[cue.idx[1]]?.start ?? word.end) - MIN_CUE_MS; w[i] = { ...word, start: Math.round(Math.max(0, Math.min(word.start + deltaMs, limit))) }; }
  else { const limit = (cue.idx.length === 1 ? word.start : w[cue.idx[cue.idx.length - 2]]?.end ?? word.start) + MIN_CUE_MS; w[i] = { ...word, end: Math.round(Math.max(word.end + deltaMs, limit)) }; }
  return { ...caps, words: w };
}

/** Delete cues with their editor's own rule (the words are hidden, not removed, so the source timing is kept). */
export function deleteCues(caps: CaptionsData, cues: LaneCue[]): CaptionsData {
  let cur = caps;
  for (const target of cues) {
    const rows = buildCues(cur, [], LANE_FPS);
    const k = rows.findIndex((r) => r.srcIdxs[0] === target.idx[0] && r.start >= 0);
    const patch = k >= 0 ? cueTextPatch(cur, rows, k, '') : null;
    if (patch) cur = { ...cur, ...patch };
  }
  return cur;
}

export interface LaneClipboard { cues: Array<{ text: string; start: number; end: number; words: Array<{ text: string; start: number; end: number }> }> }
export function copyCues(caps: CaptionsData, cues: LaneCue[]): LaneClipboard {
  const base = Math.min(...cues.map((c) => c.start));
  const w = words(caps);
  return { cues: cues.map((c) => ({ text: c.text, start: c.start - base, end: c.end - base, words: c.idx.map((i) => ({ text: w[i].text, start: w[i].start - base, end: w[i].end - base })) })) };
}
/** Paste at `atMs`: the copied cues keep their spacing and get fresh word identities. */
export function pasteCues(caps: CaptionsData, board: LaneClipboard, atMs: number, seed: string): CaptionsData {
  const add = board.cues.flatMap((c) => c.words.map((x) => ({ text: x.text, start: Math.round(atMs + x.start), end: Math.round(atMs + x.end) })));
  if (!add.length) return caps;
  const merged = sortByStart([...words(caps), ...(backfillCueIdentities(add, `${seed}:${atMs}:${(caps.words ?? []).length}`) as Words)]);
  return { ...caps, words: merged };
}

/** Nearest snap target within `thresholdMs` (playhead, clip edges, other cue edges, markers). */
export function snapMs(value: number, targets: number[], thresholdMs: number): number {
  let best = value; let dist = thresholdMs;
  for (const t of targets) { const d = Math.abs(t - value); if (d <= dist) { dist = d; best = t; } }
  return best;
}
