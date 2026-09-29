/**
 * Pure Render Studio helper functions extracted for testability.
 */

export const ASPECT_DIMS = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 },
};

export function extensionForMime(mimeType) {
  if (!mimeType) return 'webm';
  if (mimeType.includes('mp4') || mimeType.includes('avc1') || mimeType.includes('h264') || mimeType.includes('hevc')) return 'mp4';
  return 'webm';
}

export function resolveExportMimeType(format) {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const fmt = (format || 'webm').toLowerCase();
  const candidatesByFormat = {
    mp4: ['video/mp4;codecs=h264', 'video/mp4;codecs=avc1', 'video/mp4'],
    mov: ['video/mp4;codecs=h264', 'video/mp4;codecs=avc1', 'video/mp4'],
    h265: ['video/mp4;codecs=hevc', 'video/mp4;codecs=h265'],
    webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
  };
  const candidates = candidatesByFormat[fmt] || candidatesByFormat.webm;
  return candidates.find((c) => MediaRecorder.isTypeSupported(c)) || '';
}

export function getVideoBitrate({ width = 1920, height = 1080, fps = 30, quality = 82 } = {}) {
  const normalizedQuality = Math.max(0, Math.min(100, Number(quality) || 82));
  const pixels = width * height;
  const baseBps = (pixels / (1920 * 1080)) * 2_500_000;
  const fpsFactor = fps / 30;
  const qualityFactor = 0.1 + (normalizedQuality / 100) * 1.9;
  return Math.max(500_000, Math.round(baseBps * fpsFactor * qualityFactor));
}

export function computeFitSourceRect(srcWidth, srcHeight, dstWidth, dstHeight) {
  const srcAspect = srcWidth / srcHeight;
  const dstAspect = dstWidth / dstHeight;
  let sx, sy, sw, sh;
  if (srcAspect > dstAspect) {
    sh = srcHeight;
    sw = Math.round(srcHeight * dstAspect);
    sx = Math.round((srcWidth - sw) / 2);
    sy = 0;
  } else {
    sw = srcWidth;
    sh = Math.round(srcWidth / dstAspect);
    sx = 0;
    sy = Math.round((srcHeight - sh) / 2);
  }
  return { sx, sy, sw, sh };
}

export function computeTrailerDuration(timeRange, settingsDuration, sourceDurationSec) {
  if (timeRange && typeof timeRange.start === 'number' && typeof timeRange.end === 'number') {
    return Math.max(500, (timeRange.end - timeRange.start) * 1000);
  }
  if (typeof settingsDuration === 'number' && settingsDuration > 0) {
    return settingsDuration * 1000;
  }
  return (sourceDurationSec || 5) * 1000;
}

export function buildFrameFilename(baseName, format, currentTimeSec) {
  const minutes = Math.floor(currentTimeSec / 60);
  const seconds = Math.floor(currentTimeSec % 60);
  const ms = Math.floor((currentTimeSec % 1) * 1000);
  const timeTag = `${String(minutes).padStart(2, '0')}-${String(seconds).padStart(2, '0')}-${String(ms).padStart(3, '0')}`;
  const extension = format === 'image/jpeg' ? 'jpg' : format.replace('image/', '') || 'png';
  const safeBase = String(baseName || `smartvideo-frame-${timeTag}`).replace(/[^a-zA-Z0-9_-]+/g, '_');
  return `${safeBase}.${extension}`;
}
