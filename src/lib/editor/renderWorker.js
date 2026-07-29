import { drawVideoFrame, applyPresetFilter } from './renderFrameProcessor.js';

self.onmessage = async (event) => {
  try {
    const { action, job, settings = {} } = event.data || {};

    if (action === 'render') {
      const width = settings.width || 1920;
      const height = settings.height || 1080;

      const OffscreenCtor = typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas : null;
      if (!OffscreenCtor) {
        throw new Error('OffscreenCanvas is not supported');
      }

      const canvas = new OffscreenCtor(width, height);
      const ctx = canvas.getContext('2d');

      const totalFrames = settings.frames || 5;

      for (let i = 0; i < totalFrames; i++) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        try {
          if (settings.videoUrl) {
            const response = await fetch(settings.videoUrl);
            if (response.ok) {
              const blob = await response.blob();
              const bitmap = await createImageBitmap(blob);
              drawVideoFrame(bitmap, canvas, i / totalFrames);
            }
          }
        } catch {
          // proceed with blank frame if video fetch fails
        }

        if (settings.preset) {
          applyPresetFilter(ctx, settings.preset, width, height);
        }

        const percent = Math.round(((i + 1) / totalFrames) * 100);
        self.postMessage({ type: 'progress', percent });
      }

      const url = canvas.toDataURL('image/png');
      self.postMessage({
        type: 'complete',
        job,
        result: {
          success: true,
          message: 'Render complete',
          url
        }
      });
      return;
    }

    self.postMessage({
      type: 'error',
      error: 'Unknown action: ' + action
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err.message || String(err)
    });
  }
};
