/**
 * Browser-based proxy video generation.
 *
 * Creates lower-resolution proxy videos from original sources using
 * canvas + MediaRecorder. No external infrastructure required.
 */

/**
 * Generate a proxy video from an original source URL.
 *
 * @param {string} originalSrc - Original video URL
 * @param {Object} [options]
 * @param {number} [options.width=640] - Proxy width
 * @param {number} [options.height=360] - Proxy height
 * @param {string} [options.mimeType='video/webm;codecs=vp9'] - Output MIME type
 * @param {number} [options.bitrate=500000] - Target bitrate in bps
 * @returns {Promise<string>} Blob URL for the proxy video
 */
export async function generateProxyVideo(originalSrc, options = {}) {
  const {
    width = 640,
    height = 360,
    mimeType = 'video/webm;codecs=vp9',
    bitrate = 500000,
  } = options;

  // Validate MediaRecorder support
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser');
  }

  const supportedMime = MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm';
  if (!MediaRecorder.isTypeSupported(supportedMime)) {
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }

  // Load original video
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.preload = 'auto';
  video.src = originalSrc;

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve;
    video.onerror = () => reject(new Error('Failed to load original video for proxy generation'));
  });

  // Calculate proxy dimensions preserving aspect ratio
  const aspectRatio = video.videoWidth / video.videoHeight;
  let proxyWidth = width;
  let proxyHeight = height;
  if (aspectRatio > width / height) {
    proxyHeight = Math.round(width / aspectRatio);
  } else {
    proxyWidth = Math.round(height * aspectRatio);
  }

  // Setup canvas and stream
  const canvas = document.createElement('canvas');
  canvas.width = proxyWidth;
  canvas.height = proxyHeight;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: supportedMime,
    videoBitsPerSecond: bitrate,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recordingComplete = new Promise((resolve) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: supportedMime });
      resolve(URL.createObjectURL(blob));
    };
  });

  // Start recording and play video
  recorder.start();
  video.currentTime = 0;
  await video.play();

  const drawFrame = () => {
    if (video.paused || video.ended) {
      recorder.stop();
      video.pause();
      return;
    }
    ctx.drawImage(video, 0, 0, proxyWidth, proxyHeight);
    requestAnimationFrame(drawFrame);
  };

  drawFrame();

  // Wait for video to end or timeout
  const proxyUrl = await Promise.race([
    recordingComplete,
    new Promise((resolve) => {
      setTimeout(() => {
        recorder.stop();
        video.pause();
        resolve();
      }, Math.min((video.duration || 10) * 1000, 30000));
    }),
  ]);

  // Cleanup
  video.src = '';
  video.load();

  return proxyUrl || recordingComplete;
}
