// A generated or edited thumbnail is a data: or blob: URL; social platforms need a public link to fetch.
// Those are compressed (YouTube accepts JPEG/PNG under 2 MB) and uploaded straight to muapi with the user's own key.
// This deliberately does NOT use the hybrid Supabase storage: it falls back to IndexedDB and still reports
// success, which would hand a platform a link to a file that was never uploaded.
// Loaded on demand so the publish modal stays light. Throws (with a plain message) when the upload fails.
export async function toPublicThumbnailUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  const [{ prepareThumbnailFile }, { uploadImageToMuAPI, handleMuAPIUploadError }] = await Promise.all([
    import('../features/personalization/lib/thumbnailUpload'),
    import('./muapiUpload.js'),
  ]);
  const file = await prepareThumbnailFile(url);
  try {
    const { url: hosted } = await uploadImageToMuAPI(file, {});
    if (!hosted || !/^https?:\/\//i.test(hosted)) throw new Error('The upload did not return a public link.');
    return hosted;
  } catch (err) {
    throw new Error(handleMuAPIUploadError(err)?.message || err?.message || 'The thumbnail could not be uploaded.');
  }
}
