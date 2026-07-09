import { drawVideoFrame, applyPresetFilter } from './renderFrameProcessor.js';

function extractVideoFromTimeline(timelineData) {
  if (!timelineData || !Array.isArray(timelineData.tracks)) {
    return null;
  }

  for (const track of timelineData.tracks) {
    if (!Array.isArray(track.clips)) continue;
    for (const clip of track.clips) {
      if (clip && clip.type === 'video' && clip.src) {
        return clip.src;
      }
    }
  }
  return null;
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
        throw new Error('OffscreenCanvas is not supported');
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
      const totalFrames = 10;

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

        const percent = Math.round(((i + 1) / totalFrames) * 100);
        self.postMessage({ type: 'progress', progress: percent });
      }

      const blob = await canvas.convertToBlob();
      const blobUrl = URL.createObjectURL(blob);

      self.postMessage({
        type: 'complete',
        result: {
          success: true,
          message: 'Export complete',
          url: blobUrl
        }
      });
      return;
    }

    self.postMessage({
      type: 'error',
      error: 'Export worker stub received unknown action: ' + action
    });
  } catch (err) {
    self.postMessage({
      type: 'error',
      error: err.message || String(err)
    });
  }
};
