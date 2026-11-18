// [remix] Fix B3: scene scan in a Web Worker. Frames come from WebCodecs through mediabunny's CanvasSink (OffscreenCanvas), the cut detection is
// the same pure code as on the main thread (scan-core.ts), so results are the same up to decoder frame selection.
import { rgbHistogram } from './histogram-cuts';
import { abortError, scanWithSampler, type ScanOptions, type VideoSampler } from './scan-core';
import type { ScanWorkerMessage } from './scan-worker-client';

const post = (m: ScanWorkerMessage) => (self as unknown as { postMessage(m: unknown): void }).postMessage(m);
let controller: AbortController | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function openWorkerSampler(src: string, sampleWidth = 64): Promise<{ sampler: VideoSampler; dispose: () => void }> {
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.UrlSource(src), formats: mb.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) { input.dispose(); throw new Error('No video track to scan.'); }
  if (!(await track.canDecode())) { input.dispose(); throw new Error('This video cannot be decoded with WebCodecs.'); }
  const duration = await track.computeDuration();
  const first = await track.getFirstTimestamp();
  const histSink = new mb.CanvasSink(track, { width: sampleWidth });
  const thumbSinks = new Map<number, InstanceType<typeof mb.CanvasSink>>();
  let lastHist = new Float32Array(48);
  const frameAt = async (sink: InstanceType<typeof mb.CanvasSink>, t: number) => sink.getCanvas(Math.min(Math.max(first, t), Math.max(first, duration - 0.001)));
  const sampler: VideoSampler = {
    duration, width: track.displayWidth, height: track.displayHeight,
    async histAt(t) {
      const f = await frameAt(histSink, t);
      if (!f) return lastHist;
      const c = f.canvas as OffscreenCanvas; const ctx = c.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
      lastHist = rgbHistogram(ctx.getImageData(0, 0, c.width, c.height).data);
      return lastHist;
    },
    async thumbAt(t, maxW = 160) {
      let sink = thumbSinks.get(maxW); if (!sink) { sink = new mb.CanvasSink(track, { width: maxW }); thumbSinks.set(maxW, sink); }
      const f = await frameAt(sink, t); if (!f) return '';
      const blob = await (f.canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.7 });
      return `data:image/jpeg;base64,${toBase64(await blob.arrayBuffer())}`;
    },
    dispose() { /* disposed with the input */ },
  };
  return { sampler, dispose: () => input.dispose() };
}

self.onmessage = async (ev: MessageEvent<{ type: 'scan'; assetId: string; src: string; opts: ScanOptions } | { type: 'cancel' }>) => {
  const m = ev.data;
  if (m.type === 'cancel') { controller?.abort(); return; }
  controller = new AbortController();
  let open: Awaited<ReturnType<typeof openWorkerSampler>> | null = null;
  try {
    open = await openWorkerSampler(m.src);
    if (controller.signal.aborted) throw abortError();
    const scenes = await scanWithSampler(open.sampler, m.assetId, { ...m.opts, signal: controller.signal, onProgress: (fraction, phase) => post({ type: 'progress', fraction, phase }) });
    post({ type: 'done', scenes });
  } catch (e) {
    post({ type: 'error', name: (e as { name?: string })?.name ?? 'Error', message: (e as Error)?.message ?? String(e) });
  } finally { open?.dispose(); }
};
