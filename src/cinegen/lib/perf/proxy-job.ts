// [remix] Stage 4: cancellable proxy generation for CineGen import. This replaces the orphaned src/lib/editor/proxyGenerator.js
// (canvas + MediaRecorder: it plays the video in real time, cannot be cancelled and nothing imported it). It uses mediabunny (WebCodecs),
// the same engine the web media adapter already used, so a proxy is made faster than real time and can be aborted.
import { isAbort } from './jobs';

export interface ProxyOptions { width?: number; bitrate?: number; frameRate?: number; signal?: AbortSignal; onProgress?: (fraction: number) => void }

/** A low-resolution MP4 copy of the media at `url` as a blob: URL. Rejects with AbortError when cancelled. */
export async function generateProxyBlob(url: string, o: ProxyOptions = {}): Promise<Blob> {
  if (o.signal?.aborted) throw new DOMException('Proxy cancelled', 'AbortError');
  const mb = await import('mediabunny');
  const input = new mb.Input({ source: new mb.UrlSource(url), formats: mb.ALL_FORMATS });
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
  const conversion = await mb.Conversion.init({ input, output, video: { width: o.width ?? 640, bitrate: o.bitrate ?? 1_500_000, frameRate: o.frameRate ?? 24 } });
  if (!conversion.isValid) throw new Error('A proxy could not be made for this clip.');
  conversion.onProgress = (p: number) => o.onProgress?.(p);
  const onAbort = () => { void conversion.cancel(); };
  o.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await conversion.execute();
  } catch (e) {
    if (o.signal?.aborted || isAbort(e) || (e as { name?: string } | null)?.name === 'ConversionCanceledError') throw new DOMException('Proxy cancelled', 'AbortError');
    throw e;
  } finally { o.signal?.removeEventListener('abort', onAbort); }
  if (o.signal?.aborted) throw new DOMException('Proxy cancelled', 'AbortError');
  const buffer = (output.target as { buffer: ArrayBuffer | null }).buffer;
  if (!buffer) throw new Error('The proxy produced no output.');
  return new Blob([buffer], { type: 'video/mp4' });
}
