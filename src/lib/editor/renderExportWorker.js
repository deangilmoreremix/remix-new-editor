const PROGRESS_INTERVAL_MS = 500;

const ASPECT_RATIO_MAP = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 },
};

const BLEND_MODES = {
  'normal': 'source-over',
  'multiply': 'multiply',
  'screen': 'screen',
  'overlay': 'overlay',
  'soft-light': 'soft-light',
  'hard-light': 'hard-light',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'darken': 'darken',
  'lighten': 'lighten',
  'difference': 'difference',
  'exclusion': 'exclusion',
  'hue': 'hue',
  'saturation': 'saturation',
  'color': 'color',
  'luminosity': 'luminosity',
};

function getAspectDimensions(ratio) {
  return ASPECT_RATIO_MAP[ratio] || ASPECT_RATIO_MAP['16:9'];
}

function applyRemixFilters(ctx, effects, width, height) {
  if (!effects || typeof effects !== 'object') return;
  
  if (effects.brightness != null) {
    const brightness = Math.round(effects.brightness * 100);
    ctx.filter = `brightness(${brightness}%)`;
  }
  if (effects.contrast != null) {
    const contrast = Math.round(effects.contrast * 100);
    ctx.filter = (ctx.filter || '') + ` contrast(${contrast}%)`;
  }
  
  ctx.fillRect(0, 0, width, height);
  ctx.filter = 'none';
}

async function compositeEffectLayers(ctx, baseImageBitmap, layers, width, height) {
  if (!layers || !Array.isArray(layers) || layers.length === 0) return;

  // Draw base
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
  if (baseImageBitmap) {
    ctx.drawImage(baseImageBitmap, 0, 0, width, height);
  }

  for (const layer of layers) {
    if (!layer || !layer.imageBitmap) continue;
    
    ctx.globalCompositeOperation = BLEND_MODES[layer.blendMode] || 'source-over';
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity ?? 1));
    ctx.drawImage(layer.imageBitmap, 0, 0, width, height);
  }

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
}

async function createRecording(canvas, videoBitmap, durationMs, onProgress) {
  const ctx = canvas.getContext('2d');

  if (videoBitmap) {
    try {
      ctx.drawImage(videoBitmap, 0, 0, canvas.width, canvas.height);
    } catch {
      // skip single frame draw errors
    }
  }

  const stream = canvas.captureStream(30);

  const mimeType = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(e.error || new Error('MediaRecorder failed'));

    try {
      recorder.start(100);
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      reject(e);
      return;
    }

    let elapsed = 0;
    const interval = PROGRESS_INTERVAL_MS;

    const timer = setInterval(() => {
      elapsed += interval;
      const progress = Math.min(100, Math.round((elapsed / durationMs) * 100));
      onProgress(progress);

      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (elapsed >= durationMs) {
        clearInterval(timer);
        try {
          recorder.stop();
        } catch (e) {
          reject(e);
        }
      }
    }, interval);
  });
}

self.onmessage = async (event) => {
  try {
    const { action, videoUrl, settings = {}, timeRange, effects } = event.data || {};
    
    if (!action || !['export-video', 'trailer-cut', 'social-resize', 'remix-scene', 'composite-layers'].includes(action)) {
      throw new Error(`Unsupported action: ${action}`);
    }
    
    if (action !== 'export-video' && action !== 'composite-layers' && !videoUrl) {
      throw new Error('videoUrl is required');
    }
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const videoBlob = await response.blob();
    const videoBitmap = videoBlob ? await createImageBitmap(videoBlob) : null;
    
    let width = settings.width || 1920;
    let height = settings.height || 1080;
    
    if (action === 'social-resize' && settings.aspectRatio) {
      const dims = getAspectDimensions(settings.aspectRatio);
      width = dims.width;
      height = dims.height;
    }
    
    const OffscreenCtor = typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas : null;
    if (!OffscreenCtor) {
      throw new Error('OffscreenCanvas not supported in this environment');
    }
    
    const canvas = new OffscreenCtor(width, height);
    const ctx = canvas.getContext('2d');
    
    if (action === 'remix-scene') {
      if (layers && Array.isArray(layers) && layers.length > 0) {
        await compositeEffectLayers(ctx, videoBitmap, layers, width, height);
      } else {
        applyRemixFilters(ctx, effects, width, height);
      }
    } else if (action === 'composite-layers') {
      await compositeEffectLayers(ctx, videoBitmap, layers || [], width, height);
    }
    
    const durationMs = action === 'trailer-cut' && timeRange
      ? (timeRange.end - timeRange.start) * 1000
      : (typeof settings.duration === 'number' ? settings.duration : 5000);
    
    self.postMessage({ type: 'progress', percent: 0 });
    
    const recordedBlob = await createRecording(canvas, videoBitmap, durationMs, (percent) => {
      self.postMessage({ type: 'progress', percent });
    });
    
    self.postMessage({
      type: 'complete',
      blob: recordedBlob,
    }, [recordedBlob]);
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
}

export function createExportWorker() {
  const worker = new Worker(new URL('./renderExportWorker.js', import.meta.url).href, { type: 'module' });
  return {
    postMessage: (msg) => worker.postMessage(msg),
    addEventListener: (event, cb) => worker.addEventListener(event, cb),
    terminate: () => worker.terminate(),
  };
}

export function terminateExportWorker(worker) {
  if (worker && typeof worker.terminate === 'function') {
    worker.terminate();
  }
}
