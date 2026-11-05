/**
 * Grab the last frame of a local video file as a PNG File, so it can be
 * uploaded and used as an image-to-video start frame (the Video Studio's
 * "use last frame" shortcut).
 * @param {File} file
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {Promise<File>}
 */
export function extractLastFrameFile(file, { timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('Frame extraction timed out')), timeoutMs);

    video.onloadedmetadata = () => {
      // Seeking exactly to `duration` can land past the last decodable frame.
      video.currentTime = Math.max(0, (video.duration || 0) - 0.05);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return finish(reject, new Error('Could not read the video frame'));
          const base = (file.name || 'video').replace(/\.[^.]+$/, '');
          finish(resolve, new File([blob], `${base}-last-frame.png`, { type: 'image/png' }));
        }, 'image/png');
      } catch (err) {
        finish(reject, err);
      }
    };
    video.onerror = () => finish(reject, new Error('Failed to load video for frame extraction'));
    video.src = url;
  });
}
