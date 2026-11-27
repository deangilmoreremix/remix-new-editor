// [remix] AI & stock media browser (AI generation, Pexels, Pixabay): puts media into the pool and a clip on the timeline.
// Kept out of edit-tab.tsx so that file stays close to upstream CineGen (see timeline-parity.test.ts).
import { useCallback, useRef, useState, type Dispatch } from 'react';
import type { Asset } from '@cinegen/types/project';
import type { Timeline } from '@cinegen/types/timeline';
import type { WorkspaceAction } from '@cinegen/lib/mcp/workspace-state';
import { addClipToTrack } from '@cinegen/lib/editor/timeline-operations';
import { generateId } from '@cinegen/lib/utils/ids';
import { runTimelineMuapi as runMuapi } from '../../../lib/editor/ai/timelineMuapi.js';
import type { StockItem, StockKind, AiAspect } from './stock-media-popup';
import { fluxSize, DEFAULT_AI_OPTIONS, type AiOptions } from './stock-categories';

/** Largest inlined (data:) copy kept in a project when no cloud storage is available (about 15 MB of file). */
const MAX_INLINE_CHARS = 20_000_000;
// The JS helper's JSDoc only lists pollMs/timeoutMs; onProgress is supported at runtime.
/** The page's CSP allows data: images but not data: media, so a signed-out video copy is played from a blob: URL instead (lasts until reload). */
function dataUrlToBlobUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma);
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: meta.split(';')[0] || 'video/mp4' }));
}
const runTimelineMuapi = runMuapi as (tool: string, params: Record<string, unknown>, opts?: { signal?: AbortSignal; timeoutMs?: number; onProgress?: (p: { stage: string; elapsedSec?: number }) => void }) => Promise<{ url: string; model?: string }>;

interface Options {
  timeline: Timeline;
  currentTime: number;
  projectId: string;
  dispatch: Dispatch<WorkspaceAction>;
}

export function useMediaBrowser({ timeline, currentTime, projectId, dispatch }: Options) {
  const [open, setOpen] = useState(false);
  // AI generation and downloads finish long after the click. They must place the clip on the timeline as it is NOW, not as it was
  // when the request started (SET_TIMELINE replaces the whole timeline, so a stale snapshot would erase edits made in between).
  const latestRef = useRef({ timeline, currentTime });
  latestRef.current = { timeline, currentTime };

  /** Put an asset (video or image) on the first unlocked video track at `at` (default: the playhead now), creating the track if needed. */
  const placeAtPlayhead = useCallback((asset: Asset, at?: number) => {
    const { timeline: latest, currentTime: now } = latestRef.current;
    let tl = latest;
    let track = tl.tracks.find((t) => t.kind === 'video' && !t.locked);
    if (!track) {
      track = { id: generateId(), name: `Video ${tl.tracks.filter((t) => t.kind === 'video').length + 1}`, kind: 'video', color: '#4a9fd6', muted: false, solo: false, locked: false, visible: true, volume: 1 };
      tl = { ...tl, tracks: [...tl.tracks, track] };
    }
    const next = addClipToTrack(tl, track.id, asset, Math.max(0, at ?? now));
    latestRef.current = { timeline: next, currentTime: now }; // a second add before the next render builds on this one
    dispatch({ type: 'SET_TIMELINE', timelineId: latest.id, timeline: next });
  }, [dispatch]);

  /**
   * Remote media (stock or AI, video or image): copy into the project's storage and mark it persisted. Videos also get the same derive
   * jobs an import runs (thumbnail, waveform, filmstrip); without them the workspace's generic remote-asset path would mark the asset
   * "processing" but never start those jobs in the web build, and would download the original a second time.
   * `required` (an error message) makes a missing durable copy fatal (Pixabay forbids hotlinking); otherwise it falls back to the remote link.
   */
  const ingestRemote = useCallback(async (base: Asset, remoteUrl: string, opts: { required?: string } = {}): Promise<Asset> => {
    try {
      const r = await window.electronAPI.media.persistGeneratedAsset({ projectId, assetId: base.id, assetType: base.type, remoteUrl });
      // Only a copy that survives a reload counts: an https storage URL (signed in) or the file inlined as a data: URL (signed out).
      // A session-only blob: URL would be dead after a reload, and a remote link is not a copy.
      if (r && 'path' in r && r.path && r.downloaded && (/^https:\/\//i.test(r.path) || (/^data:/i.test(r.path) && r.path.length <= MAX_INLINE_CHARS))) {
        const inline = /^data:/i.test(r.path);
        const sessionOnly = inline && base.type === 'video';
        const copy = sessionOnly ? dataUrlToBlobUrl(r.path) : r.path;
        const jobs = base.type === 'video' ? [...(base.thumbnailUrl ? [] : ['generate_thumbnail']), 'compute_waveform', 'generate_filmstrip'] : [];
        return {
          // Online right away (the provider gave us the duration): the derive jobs below are tracked through processingJobs and the
          // missing artifacts, and nothing here runs the metadata job that would otherwise flip a 'processing' status back.
          ...base, url: copy, fileRef: copy, sourceUrl: remoteUrl, status: 'online',
          metadata: { ...(base.metadata ?? {}), localPersistStatus: 'ready', localPersistDownloaded: true, ...(sessionOnly ? { sessionOnlyCopy: true } : {}), ...(jobs.length ? { processingJobs: jobs } : {}) },
        };
      }
    } catch { /* cross-origin / offline / not signed in */ }
    if (opts.required) throw new Error(opts.required);
    // Use the remote link. Mark the copy as not possible so the workspace doesn't try again and leave the asset "processing".
    return { ...base, url: remoteUrl, metadata: { ...(base.metadata ?? {}), localPersistStatus: 'failed' } };
  }, [projectId]);
  const startDeriveJobs = useCallback((asset: Asset) => {
    const jobs = ((asset.metadata as Record<string, unknown> | undefined)?.processingJobs as string[] | undefined) ?? [];
    if (!asset.fileRef || !jobs.length) return;
    void window.electronAPI.media.queueProcessing({
      assetId: asset.id, projectId, inputPath: asset.fileRef, needsProxy: false,
      includeThumbnail: jobs.includes('generate_thumbnail'), includeWaveform: jobs.includes('compute_waveform'), includeFilmstrip: jobs.includes('generate_filmstrip'),
    }).catch((err: unknown) => { console.warn('[stock] could not queue media processing for', asset.id, err); }); // job failures themselves are reported by the workspace's media-job error handler
  }, [projectId]);

  const handleAddStock = useCallback(async (item: StockItem, kind: StockKind) => {
    const isVideo = kind === 'videos';
    const at = latestRef.current.currentTime; // where the playhead was when the user clicked
    const assetId = generateId();
    // Pixabay doesn't allow permanent hotlinking: its files must be copied to the user's storage, or not used at all.
    const mustCopy = item.mustCopy || item.source === 'pixabay';
    const duration = isVideo ? Math.min(30, Math.max(1, item.duration || 5)) : 5;
    let asset: Asset = {
      id: assetId, name: item.name, type: isVideo ? 'video' : 'image', url: item.src, thumbnailUrl: item.thumbnail || undefined,
      duration, width: item.width, height: item.height, createdAt: new Date().toISOString(), status: 'online', sourceUrl: item.src,
      metadata: { source: `stock-${item.source}`, credit: { user: item.user, pageURL: item.pageURL } },
    };
    const copyError = "Pixabay doesn't allow linking to its files, and a copy couldn't be saved. The link may have expired: search again, or try a smaller file.";
    try {
      asset = await ingestRemote(asset, item.src, { required: mustCopy ? copyError : undefined });
    } catch (err) {
      if (!item.fallbackSrc) throw err;
      asset = await ingestRemote({ ...asset, url: item.fallbackSrc }, item.fallbackSrc, { required: copyError }); // smaller rendition
    }
    if (!isVideo && asset.fileRef) asset = { ...asset, thumbnailUrl: asset.url }; // don't keep hotlinking the provider's preview
    dispatch({ type: 'ADD_ASSET', asset });
    placeAtPlayhead(asset, at);
    startDeriveJobs(asset);
    return (asset.metadata as Record<string, unknown> | undefined)?.sessionOnlyCopy
      ? 'Added for this session only. Sign in to keep stock videos after you reload.' : undefined;
  }, [dispatch, placeAtPlayhead, ingestRemote, startDeriveJobs]);

  // [remix] AI media from a prompt (MuAPI via /api/timeline-ai, the same path Fill Gap / the Director use): FLUX for images, Seedance for video.
  const handleGenerateAi = useCallback(async (prompt: string, kind: StockKind, aspect: AiAspect, onProgress: (msg: string) => void, opts: AiOptions = DEFAULT_AI_OPTIONS) => {
    const isVideo = kind === 'videos';
    const at = latestRef.current.currentTime;
    // Abort a request that hangs (the helper's own limit only covers polling); images are fast, videos can take a few minutes.
    const limitMs = isVideo ? 8 * 60_000 : 3 * 60_000;
    let result: { url: string; model?: string };
    try {
      result = await runTimelineMuapi(
        'generate',
        isVideo
          ? { model: 'seedance-lite-t2v', inputs: { prompt, duration: opts.duration, aspect_ratio: aspect, resolution: opts.resolution } }
          : { model: 'flux-dev', inputs: { prompt, ...fluxSize(aspect, opts.size) } },
        { signal: AbortSignal.timeout(limitMs), timeoutMs: limitMs, onProgress: (p) => onProgress(p.stage === 'generating' ? `Generating… ${p.elapsedSec ?? 0}s` : 'Submitting…') },
      );
    } catch (err) {
      const name = (err as { name?: string } | null)?.name;
      if (name === 'TimeoutError' || name === 'AbortError') throw new Error(`The ${isVideo ? 'video' : 'image'} took too long to generate. Please try again.`, { cause: err });
      throw err;
    }
    const { url, model } = result;
    const assetId = generateId();
    let asset: Asset = {
      id: assetId, name: prompt.length > 40 ? `${prompt.slice(0, 40)}…` : prompt, type: isVideo ? 'video' : 'image', url,
      duration: isVideo ? opts.duration : 5, createdAt: new Date().toISOString(), status: 'online', sourceUrl: url,
      metadata: { generatedVia: 'stock-ai', prompt, model, aspect },
    };
    asset = await ingestRemote(asset, url); // provider links expire: keep a copy in the project
    if (!isVideo) asset = { ...asset, thumbnailUrl: asset.url };
    dispatch({ type: 'ADD_ASSET', asset });
    placeAtPlayhead(asset, at);
    startDeriveJobs(asset);
    // Provider links expire: if no durable copy could be saved (e.g. not signed in), say so instead of reporting a clean success.
    const durable = Boolean(asset.fileRef);
    if ((asset.metadata as Record<string, unknown> | undefined)?.sessionOnlyCopy) return 'Added for this session only. Sign in to keep AI videos after you reload.';
    return durable ? undefined : "Added to the timeline, but a copy couldn't be saved, so this link may expire. Try again, or sign in to keep AI media in your storage.";
  }, [dispatch, placeAtPlayhead, ingestRemote, startDeriveJobs]);

  return { open, setOpen, handleAddStock, handleGenerateAi, placeAtPlayhead };
}
