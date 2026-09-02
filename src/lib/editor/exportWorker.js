import { drawVideoFrame, applyPresetFilter } from './renderFrameProcessor.js';

const PIXELS_PER_FRAME = 10;

function extractVideoFromTimeline(timelineData) {
  if (!timelineData || !Array.isArray(timelineData.tracks)) {
    return null;
  }

  for (const track of timelineData.tracks) {
    if (!Array.isArray(track.clips) && !Array.isArray(track.items)) continue;
    const clips = track.clips || track.items || [];
    for (const clip of clips) {
      if (clip && clip.type === 'video' && (clip.src || clip.source)) {
        return clip.src || clip.source;
      }
    }
  }
  return null;
}

function postProgress(percent) {
  self.postMessage({ type: 'progress', progress: Math.min(100, Math.max(0, Math.round(percent))) });
}

self.onmessage = async (event) => {
  try {
    const { action, settings, timelineData } = event.data || {};

    if (action === 'export') {
      const videoUrl = extractVideoFromTimeline(timelineData);
      const width = settings?.width || 1920;
      const height = settings?.height || 1080;

      const OffscreenCtor = typeof OffscreenCanvas !== 'undefined' ? OffscreenCanvas : null;
      if (!OffscreenCtor) {
        self.postMessage({ type: 'error', error: 'OffscreenCanvas is not supported in this environment' });
        return;
      }

      const canvas = new OffscreenCtor(width, height);
      const ctx = canvas.getContext('2d');

      let videoBitmap = null;
      if (videoUrl) {
        try {
          const response = await fetch(videoUrl);
          if (response.ok) {
            const blob = await response.blob();
            videoBitmap = await createImageBitmap(blob);
          }
        } catch {
          // proceed without video source
        }
      }

      const duration = timelineData?.duration || 5000;
      const totalFrames = PIXELS_PER_FRAME;

      for (let i = 0; i < totalFrames; i++) {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        if (videoBitmap) {
          try {
            drawVideoFrame(videoBitmap, canvas, i / totalFrames);
          } catch {
            // skip single frame draw errors
          }
        }

        if (settings?.preset) {
          applyPresetFilter(ctx, settings.preset, width, height);
        }

        postProgress(((i + 1) / totalFrames) * 100);
        await new Promise(r => setTimeout(r, 0));
      }

      const blob = await canvas.convertToBlob({ type: 'image/png' });
      const blobUrl = URL.createObjectURL(blob);

      self.postMessage({
        type: 'complete',
        result: {
          success: true,
          message: 'Export complete (worker stub)',
          url: blobUrl,
          format: settings?.format || 'png',
        }
      });
      return;
    }

    self.postMessage({
      type: 'error',
      error: 'Export worker received unknown action: ' + action
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err.message || String(err)
    });
  }
};
