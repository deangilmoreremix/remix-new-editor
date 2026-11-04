/**
 * Local media created in the editor (background-removed clips, uploads
 * that couldn't be stored). Keeps the Blob behind each object URL so the
 * sandboxed export runner can be given the file itself even where a
 * Content-Security-Policy forbids fetching blob: URLs.
 */
const blobs = new Map();

export function localMediaUrl(blob) {
  const url = URL.createObjectURL(blob);
  blobs.set(url, blob);
  return url;
}

export const localMediaBlob = (url) => blobs.get(url) || null;
