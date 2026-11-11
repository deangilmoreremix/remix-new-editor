/**
 * Frame-by-frame video processing in the browser (mediabunny / WebCodecs).
 *
 * transformVideo(src, { processFrame }) decodes a video, lets the caller edit
 * each frame's ImageData, and writes WebM (VP9, alpha kept, audio as Opus).
 * matteVideo is the special case where the caller returns an alpha matte.
 * renderFramesToWebm draws synthetic frames (e.g. a 2.5D parallax move).
 */

const abortError = () => Object.assign(new Error('Cancelled'), { name: 'AbortError' });

const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/**
 * @param {string} src
 * @param {object} opts { processFrame(imageData, frameIndex, timeSec) → ImageData|void (edit in place ok),
 *                        fromSec, toSec, maxSize, alpha (keep alpha channel; default true), onProgress, signal }
 * @returns {Promise<Blob>} video/webm
 */
export async function transformVideo(src, { processFrame, fromSec = 0, toSec = Infinity, maxSize = 1280, alpha = true, onProgress, signal } = {}) {
  if (typeof processFrame !== 'function') throw new Error('processFrame is required');
  const mb = await import('mediabunny');
  const {
    Input, BlobSource, ALL_FORMATS, CanvasSink, Output, WebMOutputFormat, BufferTarget, CanvasSource,
    AudioSampleSink, AudioSampleSource, QUALITY_HIGH, QUALITY_MEDIUM, canEncodeVideo, canEncodeAudio,
  } = mb;
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video. Use Chrome or Edge.');
  const res = await fetch(src, { signal });
  if (!res.ok) throw new Error(`Couldn't load the clip's media (HTTP ${res.status})`);
  const input = new Input({ source: new BlobSource(await res.blob()), formats: ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack();
  if (!vt) throw new Error('This clip has no video track');
  const at = await input.getPrimaryAudioTrack();
  const duration = await input.computeDuration();
  const start = Math.max(0, fromSec);
  const end = Math.min(duration, Number.isFinite(toSec) ? toSec : duration);
  if (!(end > start)) throw new Error('Nothing to process in this clip');

  const scale = Math.min(1, maxSize / Math.max(vt.displayWidth, vt.displayHeight));
  const w = Math.max(2, Math.round((vt.displayWidth * scale) / 2) * 2);
  const h = Math.max(2, Math.round((vt.displayHeight * scale) / 2) * 2);
  if (!(await canEncodeVideo('vp9', { width: w, height: h }))) throw new Error('This browser cannot encode VP9 video');
  const stats = await vt.computePacketStats(120).catch(() => null);
  const fps = stats?.averagePacketRate || 30;
  const frames = Math.max(1, Math.round((end - start) * fps));

  const work = makeCanvas(w, h);
  const wctx = work.getContext('2d', { willReadFrequently: true });
  const outCanvas = makeCanvas(w, h);
  const octx = outCanvas.getContext('2d');
  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const videoSource = new CanvasSource(outCanvas, { codec: 'vp9', bitrate: QUALITY_HIGH, ...(alpha ? { alpha: 'keep' } : {}) });
  output.addVideoTrack(videoSource, { frameRate: Math.round(fps) });
  let audioSource = null;
  if (at && await canEncodeAudio('opus').catch(() => false)) {
    audioSource = new AudioSampleSource({ codec: 'opus', bitrate: QUALITY_MEDIUM });
    output.addAudioTrack(audioSource);
  }
  await output.start();
  try {
    if (audioSource) {
      for await (const sample of new AudioSampleSink(at).samples(start, end)) {
        if (signal?.aborted) { sample.close(); throw abortError(); }
        sample.setTimestamp(Math.max(0, sample.timestamp - start));
        await audioSource.add(sample);
        sample.close();
      }
      audioSource.close();
    }
    const sink = new CanvasSink(vt, { width: w, height: h, fit: 'fill', poolSize: 2 });
    let frame = 0;
    for await (const { canvas, timestamp, duration: dur } of sink.canvases(start, end)) {
      if (signal?.aborted) throw abortError();
      wctx.clearRect(0, 0, w, h);
      wctx.drawImage(canvas, 0, 0, w, h);
      const img = wctx.getImageData(0, 0, w, h);
      const out = (await processFrame(img, frame, timestamp)) || img;
      octx.clearRect(0, 0, w, h);
      octx.putImageData(out, 0, 0);
      await videoSource.add(Math.max(0, timestamp - start), dur);
      frame += 1;
      onProgress?.({ stage: 'process', progress: Math.min(0.99, frame / frames), frame, frames });
    }
    videoSource.close();
    await output.finalize();
  } catch (err) {
    await output.cancel?.().catch(() => {});
    throw err;
  }
  onProgress?.({ stage: 'process', progress: 1, frame: frames, frames });
  return new Blob([output.target.buffer], { type: 'video/webm' });
}

/** Apply an alpha matte from `matteFor(imageData, frame, t)` to every frame. */
export function matteVideo(src, { matteFor, ...opts } = {}) {
  if (typeof matteFor !== 'function') return Promise.reject(new Error('matteFor is required'));
  return transformVideo(src, {
    ...opts,
    alpha: true,
    processFrame: async (img, frame, t) => {
      const a = await matteFor(img, frame, t);
      if (a) {
        const d = img.data;
        for (let i = 0, n = a.length; i < n; i += 1) d[i * 4 + 3] = Math.min(d[i * 4 + 3], a[i]);
      }
      return img;
    },
  });
}

/**
 * Encode synthetic frames to WebM (no audio).
 * @param {object} opts { width, height, fps=30, frames, draw(ctx, frameIndex) , onProgress, signal }
 */
export async function renderFramesToWebm({ width, height, fps = 30, frames, draw, onProgress, signal } = {}) {
  const mb = await import('mediabunny');
  const { Output, WebMOutputFormat, BufferTarget, CanvasSource, QUALITY_HIGH, canEncodeVideo } = mb;
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video. Use Chrome or Edge.');
  const w = Math.max(2, Math.round(width / 2) * 2);
  const h = Math.max(2, Math.round(height / 2) * 2);
  if (!(await canEncodeVideo('vp9', { width: w, height: h }))) throw new Error('This browser cannot encode VP9 video');
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec: 'vp9', bitrate: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  try {
    for (let i = 0; i < frames; i += 1) {
      if (signal?.aborted) throw abortError();
      ctx.clearRect(0, 0, w, h);
      await draw(ctx, i, { width: w, height: h });
      await source.add(i / fps, 1 / fps);
      onProgress?.({ stage: 'process', progress: (i + 1) / frames, frame: i + 1, frames });
    }
    source.close();
    await output.finalize();
  } catch (err) {
    await output.cancel?.().catch(() => {});
    throw err;
  }
  return new Blob([output.target.buffer], { type: 'video/webm' });
}
