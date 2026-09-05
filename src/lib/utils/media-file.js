/**
 * Minimal media-file utilities for browser-native file handling.
 *
 * CineGen's original `@/lib/utils/media-file` provides richer detection
 * and resolution helpers, but those are Electron-aware. This port keeps
 * only the browser-safe subset needed by file-picker-node.
 */

export function detectMediaType(file) {
  if (!file || !file.type) return detectMediaTypeFromExt(file.name);
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return detectMediaTypeFromExt(file.name);
}

export function detectMediaTypeFromExt(fileName) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (!ext) return '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'aiff'].includes(ext)) return 'audio';
  return '';
}

export function resolveMediaFileUrl(file) {
  return URL.createObjectURL(file);
}
