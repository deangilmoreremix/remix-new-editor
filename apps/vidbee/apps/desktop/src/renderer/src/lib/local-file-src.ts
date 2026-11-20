/**
 * Convert a local filesystem path into a `file://` URL the renderer can load.
 *
 * App-protocol URLs (`vidbee://...`) are already playable and are returned as-is.
 */
export const toLocalFileSrc = (filePath: string): string => {
  if (/^(blob|data|file|https?|vidbee):/i.test(filePath)) {
    return filePath
  }
  // [host patch] browsers cannot load file:// URLs; the host server streams download-folder files from /media.
  return `${new URL('./media', document.baseURI).href}?path=${encodeURIComponent(filePath)}`
}

/**
 * Guess a media MIME type so Video.js does not sniff a remuxed preview as Matroska.
 */
export const mediaMimeType = (src: string): string | undefined => {
  const clean = src.split('?')[0]?.toLowerCase() ?? ''
  if (clean.endsWith('.mp4') || clean.endsWith('.m4v') || clean.endsWith('.m4a')) {
    return clean.endsWith('.m4a') ? 'audio/mp4' : 'video/mp4'
  }
  if (clean.endsWith('.webm')) {
    return 'video/webm'
  }
  if (clean.endsWith('.mp3')) {
    return 'audio/mpeg'
  }
  return undefined
}
