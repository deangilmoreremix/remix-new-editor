/**
 * Turn a generated/edited thumbnail (data: or blob: URL) into a File that can be
 * uploaded so YouTube/Instagram can fetch it. YouTube accepts JPEG/PNG under 2 MB,
 * so a larger image is re-encoded as JPEG (quality stepped down until it fits).
 */
export const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

async function reencodeJpeg(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not compress the thumbnail.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  for (const q of [0.92, 0.85, 0.75, 0.65, 0.5]) {
    const out: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (out && out.size <= THUMBNAIL_MAX_BYTES) return out;
  }
  throw new Error('The thumbnail is larger than 2 MB even after compressing. Use a smaller size.');
}

export async function prepareThumbnailFile(url: string): Promise<File> {
  let blob: Blob;
  try {
    blob = await (await fetch(url)).blob();
  } catch {
    throw new Error('The thumbnail could not be read. Generate it again and publish again.');
  }
  if (blob.size > THUMBNAIL_MAX_BYTES) blob = await reencodeJpeg(blob);
  const type = blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  return new File([blob], `thumbnail-${Date.now()}.${type === 'image/jpeg' ? 'jpg' : 'png'}`, { type });
}
