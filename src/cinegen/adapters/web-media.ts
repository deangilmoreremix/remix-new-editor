// [remix] Browser implementation of CineGen's media pipeline (`electronAPI.media`, `dialog`, `file`).
// CineGen's main process probes files and derives thumbnails / waveforms / filmstrips with ffmpeg and sends
// `media:job-complete` events. Here the same jobs run in the browser (video/audio elements, canvas, WebAudio,
// CineGen's own extractWaveformPeaks / extractFilmstripFrames) and emit the same events, so CineGen's
// workspace logic is unchanged. Picked files are uploaded to our storage so they survive a reload; if the
// upload is unavailable the file stays usable for this session as a blob URL.
import { extractWaveformPeaks } from '@cinegen/lib/editor/waveform';
import { extractFilmstripFrames } from '@cinegen/lib/editor/filmstrip';
import { uploadFileToStorage } from '../../lib/supabase.js';

type JobEvent = { jobId: string; assetId?: string; jobType?: string; result?: unknown; error?: string };
const completeListeners = new Set<(e: JobEvent) => void>();
const errorListeners = new Set<(e: JobEvent) => void>();
const emitComplete = (e: JobEvent) => completeListeners.forEach((fn) => fn(e));
const emitError = (e: JobEvent) => errorListeners.forEach((fn) => fn(e));

/** Picked files by the URL we handed to CineGen (for names and types). */
export const webFiles = new Map<string, { name: string; type: string; size: number }>();
(window as unknown as { __remixFileNames?: Map<string, string> }).__remixFileNames = new Map();

const AUDIO_EXT = /\.(wav|mp3|aac|flac|ogg|m4a)(\?|#|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|bmp|tiff?|webp|avif)(\?|#|$)/i;
export function mediaTypeOf(url: string): 'video' | 'audio' | 'image' {
  const meta = webFiles.get(url);
  if (meta?.type.startsWith('audio/')) return 'audio';
  if (meta?.type.startsWith('image/')) return 'image';
  if (meta?.type.startsWith('video/')) return 'video';
  if (AUDIO_EXT.test(url)) return 'audio';
  if (IMAGE_EXT.test(url)) return 'image';
  return 'video';
}

function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => { resolve([...(input.files ?? [])]); input.remove(); }, { once: true });
    input.addEventListener('cancel', () => { resolve([]); input.remove(); }, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

async function durableUrl(file: File): Promise<string> {
  try {
    const url = await uploadFileToStorage(file);
    if (url) return url as string;
  } catch { /* offline / not signed in */ }
  return URL.createObjectURL(file);
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.crossOrigin = 'anonymous'; v.muted = true; v.preload = 'auto'; v.playsInline = true;
    const t = setTimeout(() => reject(new Error('Timed out reading the video')), 20000);
    v.addEventListener('loadeddata', () => { clearTimeout(t); resolve(v); }, { once: true });
    v.addEventListener('error', () => { clearTimeout(t); reject(new Error('Could not read this media')); }, { once: true });
    v.src = url;
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => resolve();
    v.addEventListener('seeked', done, { once: true });
    v.currentTime = Math.min(Math.max(0, t), Math.max(0, (v.duration || 0) - 0.05));
    setTimeout(done, 4000);
  });
}

export async function frameDataUrl(url: string, timeSec: number, maxWidth = 1280, mime = 'image/jpeg'): Promise<string> {
  if (mediaTypeOf(url) === 'image') return url;
  const v = await loadVideo(url);
  await seek(v, timeSec);
  const scale = Math.min(1, maxWidth / (v.videoWidth || maxWidth));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((v.videoWidth || 640) * scale));
  c.height = Math.max(1, Math.round((v.videoHeight || 360) * scale));
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL(mime, 0.85);
}

async function probe(url: string, type: string) {
  if (type === 'image') {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read this image')); i.src = url; });
    return { duration: 5, width: img.naturalWidth, height: img.naturalHeight, fileSize: webFiles.get(url)?.size };
  }
  if (type === 'audio') {
    const a = document.createElement('audio');
    a.preload = 'metadata';
    await new Promise<void>((res, rej) => { a.onloadedmetadata = () => res(); a.onerror = () => rej(new Error('Could not read this audio')); a.src = url; });
    return { duration: a.duration, fileSize: webFiles.get(url)?.size };
  }
  const v = await loadVideo(url);
  return { duration: v.duration, width: v.videoWidth, height: v.videoHeight, fps: 30, fileSize: webFiles.get(url)?.size };
}

async function runJob(assetId: string, url: string, jobType: string) {
  const jobId = `web-${jobType}-${Math.random().toString(36).slice(2, 8)}`;
  const type = mediaTypeOf(url);
  try {
    let result: unknown;
    if (jobType === 'extract_metadata') result = await probe(url, type);
    else if (jobType === 'generate_thumbnail') result = { outputPath: await frameDataUrl(url, 0.1, 480) };
    else if (jobType === 'compute_waveform') {
      // CineGen reads peaks from `peaksPath` (a JSON array URL). A data: URL keeps them durable across reloads.
      const peaks = await extractWaveformPeaks(url, 1500);
      result = { peaks, peaksPath: `data:application/json,${encodeURIComponent(JSON.stringify(peaks.map((p) => Math.round(p * 1000) / 1000)))}` };
    }
    else if (jobType === 'generate_filmstrip') result = { frames: await extractFilmstripFrames(url) };
    else result = {}; // generate_proxy: the browser plays the original
    emitComplete({ jobId, assetId, jobType, result });
  } catch (error) {
    emitError({ jobId, assetId, jobType, error: error instanceof Error ? error.message : String(error) });
  }
}

/** Cut [startSec, endSec) out of a media file in the browser (mediabunny / WebCodecs); returns a blob: URL. */
async function trimToBlobUrl(inputPath: string, startSec: number, endSec: number): Promise<string> {
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.UrlSource(inputPath), formats: mb.ALL_FORMATS });
  const audioOnly = mediaTypeOf(inputPath) === 'audio';
  const output = new mb.Output({ format: audioOnly ? new mb.Mp3OutputFormat() : new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
  const conversion = await mb.Conversion.init({ input, output, trim: { start: Math.max(0, startSec), end: endSec } });
  if (!conversion.isValid) throw new Error('This media cannot be trimmed in the browser.');
  await conversion.execute();
  const buffer = (output.target as { buffer: ArrayBuffer | null }).buffer;
  if (!buffer) throw new Error('The trim produced no output.');
  const blob = new Blob([buffer], { type: audioOnly ? 'audio/mpeg' : 'video/mp4' });
  const url = URL.createObjectURL(blob);
  webFiles.set(url, { name: 'trim', type: blob.type, size: blob.size });
  return url;
}

/** A public URL for media the model APIs must fetch: https passes through, local media is uploaded. */
async function publicUrlFor(source: string): Promise<{ url: string }> {
  if (/^https:\/\//i.test(source)) return { url: source };
  const blob = await (await fetch(source)).blob();
  const name = webFiles.get(source)?.name ?? 'media';
  const url = await durableUrl(new File([blob], name, { type: blob.type }));
  if (!/^https:\/\//i.test(url)) throw new Error('Could not upload this media. Sign in so uploads are available.');
  return { url };
}

export const webMediaApi = {
  elements: {
    uploadMediaSource: async (source: unknown) => publicUrlFor(String(source)),
    uploadTranscriptionSource: async (source: unknown) => publicUrlFor(String(source)),
  },
  shell: { openPath: async (target: unknown) => { window.open(String(target), '_blank', 'noopener'); } },
  media: {
    import: async (p: unknown) => {
      const { filePaths } = p as { filePaths: string[] };
      return filePaths.map((filePath) => {
        const type = mediaTypeOf(filePath);
        const assetId = `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const jobs = type === 'video' ? ['extract_metadata', 'generate_thumbnail', 'compute_waveform', 'generate_filmstrip']
          : type === 'audio' ? ['extract_metadata', 'compute_waveform'] : ['extract_metadata', 'generate_thumbnail'];
        // Run after the caller has added the asset (events for unknown assets are queued by the workspace anyway).
        setTimeout(() => { for (const job of jobs) void runJob(assetId, filePath, job); }, 0);
        return { assetId, filePath, type };
      });
    },
    queueProcessing: async (p: unknown) => {
      const a = p as { assetId: string; inputPath: string; includeThumbnail?: boolean; includeWaveform?: boolean; includeFilmstrip?: boolean; needsProxy?: boolean };
      const jobs = [a.includeThumbnail && 'generate_thumbnail', a.includeWaveform && 'compute_waveform', a.includeFilmstrip && 'generate_filmstrip', a.needsProxy && 'generate_proxy'].filter(Boolean) as string[];
      for (const job of jobs) void runJob(a.assetId, a.inputPath, job);
      return { queued: jobs.length };
    },
    onJobComplete: (cb: unknown) => { const fn = cb as (e: JobEvent) => void; completeListeners.add(fn); return () => completeListeners.delete(fn); },
    onJobError: (cb: unknown) => { const fn = cb as (e: JobEvent) => void; errorListeners.add(fn); return () => errorListeners.delete(fn); },
    extractFrame: async (p: unknown) => {
      const a = p as { inputPath: string; timeSec: number };
      return { outputPath: await frameDataUrl(a.inputPath, a.timeSec, 1920) };
    },
    trimVideo: async (p: unknown) => {
      const a = p as { inputPath: string; startSec: number; endSec: number };
      return { outputPath: await trimToBlobUrl(a.inputPath, a.startSec, a.endSec) };
    },
    extractClip: async (p: unknown) => {
      const a = p as { inputPath: string; startTimeSec: number; durationSec: number };
      return { outputPath: await trimToBlobUrl(a.inputPath, a.startTimeSec, a.startTimeSec + a.durationSec) };
    },
    downloadRemote: async (p: unknown) => ({ path: (p as { url: string }).url }), // the browser streams remote media; nothing to download
    writeTempImage: async (p: unknown) => ({ outputPath: (p as { dataUrl: string }).dataUrl }),
  },
  dialog: {
    showOpen: async (opts: unknown) => {
      const o = opts as { filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] } | undefined;
      const accept = (o?.filters?.[0]?.extensions ?? []).map((e) => `.${e}`).join(',') || 'video/*,audio/*,image/*';
      const files = await pickFiles(accept, Boolean(o?.properties?.includes('multiSelections')));
      if (!files.length) return null;
      const urls: string[] = [];
      for (const file of files) {
        const url = await durableUrl(file);
        webFiles.set(url, { name: file.name, type: file.type, size: file.size });
        (window as unknown as { __remixFileNames: Map<string, string> }).__remixFileNames.set(url, file.name);
        urls.push(url);
      }
      return urls;
    },
  },
  file: { getPathForFile: (file: File) => (file as unknown as { path?: string }).path ?? '' },
};
