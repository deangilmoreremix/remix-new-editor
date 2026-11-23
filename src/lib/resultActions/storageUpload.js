/**
 * Puts one file into the public `uploads` bucket at an exact path and returns its public address.
 * The old helper (hybrid-supabase uploadFileToStorage) always picks a random name and gives up after 60 s;
 * copying a generated video needs a stable name (so a second "Get link" reuses the file) and more time.
 *
 * The path must start with `smartvideo/<owner>/`, the prefix the storage policies are written for.
 */

const EXISTS = /already exists|duplicate|resource already|409/i;

/**
 * @returns {Promise<{ url: string, existed: boolean }>}
 * @throws Error with `.code` 'upload_failed' | 'timeout'
 */
export async function uploadToUploadsBucket(path, file, { timeoutMs = 240000, client } = {}) {
  const sb = client || (await import('../hybrid-supabase.js')).hybridSupabase;
  await sb.refreshUserHeader?.();
  const bucket = sb.storage.from('uploads');
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error('The upload took too long.'), { code: 'timeout' })), timeoutMs); });
  let existed = false;
  try {
    const { error } = await Promise.race([bucket.upload(path, file, { contentType: file.type, upsert: false }), timeout]);
    if (error) {
      if (EXISTS.test(`${error.message || ''} ${error.statusCode || ''} ${error.error || ''}`)) existed = true;
      else throw Object.assign(new Error(error.message || 'Upload failed.'), { code: 'upload_failed' });
    }
  } finally { clearTimeout(timer); }
  const { data } = bucket.getPublicUrl(path);
  if (!data?.publicUrl) throw Object.assign(new Error('The file was saved but its address could not be read.'), { code: 'upload_failed' });
  return { url: data.publicUrl, existed };
}
