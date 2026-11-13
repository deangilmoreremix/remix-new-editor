// [remix] Real video thumbnails for published CineGen timelines. One frame is rendered with the editor's own sandboxed
// renderer, uploaded to the same storage as other media, and saved on the timeline's `timeline_projects` row
// (`thumbnail_url`), which the overview and Analytics cards already show. Everything is best-effort: a failure never
// blocks publishing, and it returns null so the card keeps its placeholder.
// @ts-expect-error plain JS
import { captureThumbnail, hasVisualMedia } from '../../../lib/editor/projectLibrary/thumbnail.js';

type Client = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ThumbnailDeps {
  buildModel: (built: unknown) => Promise<unknown> | unknown;
  renderStill: (model: unknown, frame: number) => Promise<{ blob: Blob }>;
  upload: (file: File) => Promise<string>;
}

const done = new Set<string>(); // rows captured (or already having one) this session
/** A render or upload that never settles must not block later captures for the row. */
export const CAPTURE_TIMEOUT_MS = 60_000;
const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
const chain = new Map<string, Promise<unknown>>(); // per-row queue so a newer capture always saves after an older one

async function realDeps(aspect?: string | null): Promise<ThumbnailDeps> {
  const [{ timelineToComposition }, { renderStill }, { uploadFileToStorage }] = await Promise.all([
    import('../../../lib/editor/remotion/timelineToComposition.js'),
    import('../../../lib/editor/remotion/exportClient.js'),
    import('../../../lib/hybrid-supabase.js'),
  ]);
  return {
    buildModel: (b) => timelineToComposition(b, { fps: 30, quality: '720p', aspect }),
    renderStill, upload: uploadFileToStorage,
  };
}

type Opts = { aspect?: string | null; force?: boolean; deps?: ThumbnailDeps };

async function capture(client: Client, rowId: string, built: { timelineSeconds?: number; [k: string]: unknown }, opts: Opts): Promise<string | null> {
  try {
    if (!hasVisualMedia(built)) { if (!opts.force) done.delete(rowId); return null; }
    if (!opts.force) {
      const { data, error } = await client.from('timeline_projects').select('thumbnail_url').eq('id', rowId).maybeSingle();
      if (error) { done.delete(rowId); return null; }
      if (data?.thumbnail_url) return null; // already has one; the claim stays
    }
    const deps = opts.deps ?? await realDeps(opts.aspect);
    const url: string | null = await withTimeout<string | null>(captureThumbnail(built, { ...deps, fps: 30 }), CAPTURE_TIMEOUT_MS);
    if (!url) { done.delete(rowId); return null; }
    const { error } = await client.from('timeline_projects').update({ thumbnail_url: url }).eq('id', rowId);
    if (error) { done.delete(rowId); return null; }
    done.add(rowId);
    return url;
  } catch {
    done.delete(rowId);
    return null;
  }
}

/**
 * Capture and save the thumbnail for one project row. Resolves to the URL, or null (nothing to render / failed / already set).
 * Non-forced calls claim the row synchronously, so overlapping calls render once; every call for a row runs in order,
 * so a forced (publish) capture can never be overwritten by an older, slower one.
 */
export function captureRowThumbnail(client: Client, rowId: string, built: { timelineSeconds?: number; [k: string]: unknown }, opts: Opts = {}): Promise<string | null> {
  if (!opts.force) {
    if (done.has(rowId)) return Promise.resolve(null);
    done.add(rowId); // claim before any await
  }
  const prev = chain.get(rowId) ?? Promise.resolve();
  const run = prev.then(() => capture(client, rowId, built, opts));
  chain.set(rowId, run);
  void run.finally(() => { if (chain.get(rowId) === run) chain.delete(rowId); });
  return run;
}

/** Test hook. */
export const resetThumbnailSession = () => { done.clear(); chain.clear(); };
