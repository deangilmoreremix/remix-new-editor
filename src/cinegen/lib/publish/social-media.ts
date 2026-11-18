// [remix] Which videos can be sent to social networks, and how to get each one a PUBLIC link (the publisher needs one: a network cannot fetch a
// blob: address that only exists in this browser tab). Pure and unit-tested; the panel only draws it and the upload is passed in.
import type { Asset } from '@cinegen/types/project';
import type { ExportJob } from '@cinegen/types/export';

export type SocialSourceId = 'exports' | 'media' | 'templates';
export interface SocialVideo {
  id: string;
  source: SocialSourceId;
  title: string;
  url: string;
  poster: string | null;
  duration: number | null;
  aspect: '16:9' | '9:16' | '1:1';
  /** true when `url` is not reachable from outside this browser (blob:, data:, a relative path) and must be uploaded first. */
  needsUpload: boolean;
}
export const SOCIAL_SOURCE_LABEL: Record<SocialSourceId, string> = { exports: 'Your exports', media: 'Media pool', templates: 'Template videos' };

/** Reachable by anyone on the internet: an https address that is not this machine. */
export function isPublicUrl(url: string | undefined | null): boolean {
  if (!url || !/^https:\/\//i.test(url)) return false;
  try { const h = new URL(url).hostname; return h !== 'localhost' && h !== '127.0.0.1' && !h.endsWith('.local'); } catch { return false; }
}

export function aspectOf(width?: number | null, height?: number | null, ratio?: string): SocialVideo['aspect'] {
  let n = 16 / 9;
  if (width && height) n = width / height;
  else if (ratio) { const [w, h] = ratio.split(':').map(Number); if (w > 0 && h > 0) n = w / h; }
  return Math.abs(n - 1) < 0.12 ? '1:1' : n > 1 ? '16:9' : '9:16';
}

interface TemplateVideoLike { id: string; title: string; videoSrc: string; posterSrc: string | null; duration: number | null; aspectRatio: string }

/** Finished exports of this project (newest first). Only ones that still have a link: a blob: address from an earlier session is gone. */
export function exportVideos(exports: ExportJob[], aspect: SocialVideo['aspect'] = '16:9'): SocialVideo[] {
  return exports.filter((e) => e.status === 'complete' && !!e.outputUrl).slice().reverse().map((e, i) => ({
    id: `export:${e.id}`, source: 'exports' as const, title: `Export ${exports.filter((x) => x.status === 'complete' && x.outputUrl).length - i} · ${e.preset}`,
    url: e.outputUrl!, poster: null, duration: null, aspect, needsUpload: !isPublicUrl(e.outputUrl),
  }));
}
export function mediaVideos(assets: Asset[]): SocialVideo[] {
  return assets.filter((a) => a.type === 'video' && !!a.url).map((a) => ({
    id: `media:${a.id}`, source: 'media' as const, title: a.name, url: a.url, poster: a.thumbnailUrl ?? null, duration: a.duration ?? null,
    aspect: aspectOf(a.width, a.height), needsUpload: !isPublicUrl(a.url),
  }));
}
export function templateVideoList(items: TemplateVideoLike[]): SocialVideo[] {
  return items.map((t) => ({ id: `template:${t.id}`, source: 'templates' as const, title: t.title, url: t.videoSrc, poster: t.posterSrc, duration: t.duration, aspect: aspectOf(null, null, t.aspectRatio), needsUpload: !isPublicUrl(t.videoSrc) }));
}

export function sourceCounts(all: SocialVideo[], q: string, aspect: string): Record<SocialSourceId, number> {
  const base = filterVideos(all, null, q, aspect);
  return { exports: base.filter((v) => v.source === 'exports').length, media: base.filter((v) => v.source === 'media').length, templates: base.filter((v) => v.source === 'templates').length };
}
/** `source` null = every source. Counts on the chips use this with source = null so they do not collapse to the active chip. */
export function filterVideos(all: SocialVideo[], source: SocialSourceId | null, q: string, aspect: string): SocialVideo[] {
  const s = q.trim().toLowerCase();
  return all.filter((v) => (!source || v.source === source) && (aspect === 'all' || v.aspect === aspect) && (!s || v.title.toLowerCase().includes(s)));
}

/**
 * The public link for a video: itself when it already has one, otherwise `upload(file)` of its bytes. Throws a readable Error when the
 * bytes cannot be read or the upload fails, so the panel can show it. `fetchImpl` / `upload` are parameters so tests need no network.
 */
export async function resolvePublicUrl(video: SocialVideo, upload: (file: File) => Promise<string>, fetchImpl: typeof fetch = globalThis.fetch): Promise<string> {
  if (!video.needsUpload) return video.url;
  let blob: Blob;
  try { const res = await fetchImpl(video.url); if (!res.ok) throw new Error(`HTTP ${res.status}`); blob = await res.blob(); }
  catch { throw new Error('Could not read this video. Render it again in the Export tab, then try once more.'); }
  const type = blob.type && blob.type.startsWith('video/') ? blob.type : 'video/mp4';
  const ext = type.includes('webm') ? 'webm' : 'mp4';
  let url: string;
  try { url = await upload(new File([blob], `${video.title.replace(/[^\w-]+/g, '-').slice(0, 40) || 'video'}.${ext}`, { type })); }
  catch (e) { throw new Error(e instanceof Error && /sign|auth|jwt/i.test(e.message) ? 'Sign in to publish to social networks.' : `Upload failed: ${e instanceof Error ? e.message : 'try again'}`); }
  if (!isPublicUrl(url)) throw new Error('The uploaded video did not get a public link. Try again.');
  return url;
}
