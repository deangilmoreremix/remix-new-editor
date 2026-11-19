// [remix] Stage 4: media relinking. Pure matching of missing media-pool assets against files the user picked.
export interface MissingAsset { id: string; name: string; size?: number; duration?: number; originalPath?: string; type?: string }
export interface CandidateFile { name: string; size: number; lastModified?: number; type?: string; duration?: number }
export interface RelinkMatch { assetId: string; fileIndex: number; score: number; reasons: string[] }

const stem = (n: string) => n.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const ext = (n: string) => (/\.([^.\\/]+)$/.exec(n)?.[1] ?? '').toLowerCase();
const base = (n: string) => n.replace(/^.*[\\/]/, '').toLowerCase();

/** Score one file against one asset: exact filename 5, same stem 3, same extension 1, same size 4 (or within 1 %: 1), same duration 2. */
export function scoreMatch(a: MissingAsset, f: CandidateFile): { score: number; reasons: string[] } {
  let score = 0; const reasons: string[] = [];
  const names = [a.name, a.originalPath].filter(Boolean) as string[];
  if (names.some((n) => base(n) === base(f.name))) { score += 5; reasons.push('same file name'); }
  else if (names.some((n) => stem(n) && stem(n) === stem(f.name))) { score += 3; reasons.push('same name, other extension'); }
  else if (names.some((n) => stem(n).length >= 4 && (stem(f.name).includes(stem(n)) || stem(n).includes(stem(f.name))))) { score += 1; reasons.push('similar name'); }
  if (names.some((n) => ext(n) && ext(n) === ext(f.name))) score += 1;
  if (a.size && f.size) {
    if (a.size === f.size) { score += 4; reasons.push('same size'); }
    else if (Math.abs(a.size - f.size) / a.size < 0.01) { score += 1; reasons.push('size within 1%'); }
  }
  if (a.duration && f.duration && Math.abs(a.duration - f.duration) < 0.05) { score += 2; reasons.push('same duration'); }
  return { score, reasons };
}

/** Best one-to-one assignment (greedy by score) with a minimum score; each file is used for at most one asset. */
export function matchRelinks(missing: readonly MissingAsset[], files: readonly CandidateFile[], minScore = 3): RelinkMatch[] {
  const pairs: RelinkMatch[] = [];
  missing.forEach((a) => files.forEach((f, fileIndex) => {
    const { score, reasons } = scoreMatch(a, f);
    if (score >= minScore) pairs.push({ assetId: a.id, fileIndex, score, reasons });
  }));
  pairs.sort((x, y) => y.score - x.score);
  const usedA = new Set<string>(); const usedF = new Set<number>(); const out: RelinkMatch[] = [];
  for (const p of pairs) { if (usedA.has(p.assetId) || usedF.has(p.fileIndex)) continue; usedA.add(p.assetId); usedF.add(p.fileIndex); out.push(p); }
  return out;
}

/** Whether a source URL can still be read. blob: URLs from an earlier session, deleted files and dead links report false. */
export async function probeSource(url: string, signal?: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!url) return false;
  if (/^data:/i.test(url)) return true;
  try {
    const res = await fetchImpl(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal });
    try { await res.body?.cancel(); } catch { /* nothing to cancel */ }
    return res.ok || res.status === 206;
  } catch (e) {
    if ((e as { name?: string } | null)?.name === 'AbortError') throw e;
    return false;
  }
}
