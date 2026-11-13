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

/** Capture and save the thumbnail for one project row. Resolves to the URL, or null (nothing to render / failed / already set). */
export async function captureRowThumbnail(
  client: Client,
  rowId: string,
  built: { timelineSeconds?: number; [k: string]: unknown },
  opts: { aspect?: string | null; force?: boolean; deps?: ThumbnailDeps } = {},
): Promise<string | null> {
  try {
    if (!opts.force && done.has(rowId)) return null;
    if (!hasVisualMedia(built)) return null;
    if (!opts.force) {
      const { data, error } = await client.from('timeline_projects').select('thumbnail_url').eq('id', rowId).maybeSingle();
      if (error) return null;
      if (data?.thumbnail_url) { done.add(rowId); return null; }
    }
    done.add(rowId); // claim before the slow render so a second call does not start another
    const deps = opts.deps ?? await realDeps(opts.aspect);
    const url: string | null = await captureThumbnail(built, { ...deps, fps: 30 });
    if (!url) { done.delete(rowId); return null; }
    const { error } = await client.from('timeline_projects').update({ thumbnail_url: url }).eq('id', rowId);
    if (error) { done.delete(rowId); return null; }
    return url;
  } catch {
    done.delete(rowId);
    return null;
  }
}

/** Test hook. */
export const _resetThumbnailSession = () => done.clear();
