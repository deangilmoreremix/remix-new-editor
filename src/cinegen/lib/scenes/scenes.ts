// [remix] Stage 4: scene records for the scene browser and search over their metadata. Pure.
export interface SceneInfo {
  id: string;
  assetId: string;
  index: number;
  name: string;
  startSec: number;
  endSec: number;
  tags: string[];
  /** small JPEG data URL of the scene's middle frame (cached in IndexedDB, see lib/perf/thumb-cache.ts) */
  thumb?: string;
}

export function formatTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
}

/** Scenes from cut times (seconds): [0, c1), [c1, c2) ... [cN, duration). Cuts closer than minSceneSec to a neighbour or to the ends are ignored. */
export function scenesFromCuts(assetId: string, assetName: string, cutsSec: readonly number[], durationSec: number, minSceneSec = 0.2): SceneInfo[] {
  const edges = [0];
  for (const c of [...cutsSec].sort((x, y) => x - y)) if (c - edges[edges.length - 1] >= minSceneSec && durationSec - c >= minSceneSec) edges.push(c);
  edges.push(durationSec);
  const merged = edges;
  const out: SceneInfo[] = [];
  for (let i = 0; i < merged.length - 1; i++) {
    out.push({ id: `${assetId}:${i}`, assetId, index: i, name: `${assetName} - scene ${i + 1}`, startSec: merged[i], endSec: merged[i + 1], tags: [] });
  }
  return out;
}

/** "0:12", "12.5", "1:02.5" -> seconds, or null */
export function parseTimeToken(tok: string): number | null {
  const m = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(tok.trim());
  if (!m) return null;
  return (m[1] ? Number(m[1]) * 60 : 0) + Number(m[2]);
}

/**
 * Search scene metadata. Words match the name and tags (all words must match); `tag:foo` matches tags only; a time with a colon or decimal point (`12.5`, `1:02`; a bare number matches names only)
 * keeps the scene that contains it; `>5` / `<5` filter by scene length in seconds. Name matches rank above tag matches.
 */
export function searchScenes(scenes: readonly SceneInfo[], query: string): SceneInfo[] {
  const toks = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return [...scenes];
  const scored: Array<{ s: SceneInfo; rank: number }> = [];
  for (const s of scenes) {
    let rank = 0; let ok = true;
    const name = s.name.toLowerCase(); const tags = s.tags.map((t) => t.toLowerCase());
    for (const tok of toks) {
      const len = s.endSec - s.startSec;
      if (tok.startsWith('tag:')) { const q = tok.slice(4); if (q && tags.some((t) => t.includes(q))) rank += 2; else ok = false; continue; }
      if ((tok.startsWith('>') || tok.startsWith('<')) && Number.isFinite(Number(tok.slice(1)))) { if (tok[0] === '>' ? len > Number(tok.slice(1)) : len < Number(tok.slice(1))) rank += 1; else ok = false; continue; }
      const t = parseTimeToken(tok);
      if (t !== null && /[:.]/.test(tok) && !name.includes(tok)) { if (t >= s.startSec && t < s.endSec) rank += 3; else ok = false; continue; }
      if (name.includes(tok)) rank += 2; else if (tags.some((x) => x.includes(tok))) rank += 1; else { ok = false; }
    }
    if (ok) scored.push({ s, rank });
  }
  return scored.sort((a, b) => b.rank - a.rank || a.s.startSec - b.s.startSec).map((x) => x.s);
}

/** Frame stepping: next/previous frame time at the given fps, clamped to the media. */
export function stepFrame(timeSec: number, direction: 1 | -1, fps: number, durationSec: number): number {
  const f = Math.round(timeSec * fps) + direction;
  return Math.min(Math.max(0, f / fps), Math.max(0, durationSec - 1 / fps));
}
