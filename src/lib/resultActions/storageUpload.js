/**
 * Puts one file into the public `uploads` bucket at an exact path and returns its public address.
 *
 * Uses the REAL storage client (hybridSupabase.supabase), never the hybrid wrapper: that wrapper turns ANY upload
 * error (permission, size, network) into a copy in the browser's offline store and reports success, which would give
 * the user a link to a file that does not exist. Every failure here throws an Error with a plain message and `.code`.
 *
 * The path must start with `smartvideo/<owner>/`, the prefix the storage policies are written for. There is no
 * UPDATE policy, so files are never overwritten (upsert: false); an existing file is accepted only when its size
 * matches, otherwise the name is in use by a different file ('conflict').
 */

const EXISTS = /already exists|duplicate|resource already|409/i;

const fail = (code, message) => Object.assign(new Error(message), { code });

/** A message a person can act on, from a storage error. */
export function describeUploadError(error) {
  const status = Number(error?.statusCode ?? error?.status) || 0;
  const text = `${error?.message || ''} ${error?.error || ''}`.toLowerCase();
  if (status === 413 || /too large|exceeded|payload|size limit/.test(text)) return 'The file is larger than the storage limit.';
  if (status === 401 || status === 403 || /row-level|policy|jwt|not authorized|unauthori|permission|forbidden/.test(text)) return 'You are not allowed to save here. Sign in and try again.';
  if (/mime|file type|not supported/.test(text)) return 'This file type is not allowed.';
  return `Saving the file failed${error?.message ? ` (${String(error.message).slice(0, 80)})` : ''}. Try again.`;
}

/**
 * Is the file really there, and how big is it? HEAD first; a server that refuses HEAD gets a 1-byte range request.
 * @returns {Promise<{ exists: boolean, size: number|null }>}
 * @throws when the address cannot be reached at all (so the caller can say "could not confirm")
 */
export async function verifyPublicFile(url, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  const ask = async (init) => {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try { return await fetchImpl(url, { ...init, ...(ctrl ? { signal: ctrl.signal } : {}) }); } finally { if (timer) clearTimeout(timer); }
  };
  let res = await ask({ method: 'HEAD' });
  if (res.status === 405 || res.status === 501) res = await ask({ method: 'GET', headers: { Range: 'bytes=0-0' } });
  if (res.status === 404) return { exists: false, size: null };
  if (!res.ok) throw fail('unconfirmed', 'The file was saved but could not be confirmed.');
  const total = /\/(\d+)\s*$/.exec(res.headers?.get?.('content-range') || '');
  const size = total ? Number(total[1]) : (Number(res.headers?.get?.('content-length')) || null);
  return { exists: true, size };
}

/**
 * @returns {Promise<{ url: string, existed: boolean }>}
 * @throws Error with `.code` 'upload_failed' | 'timeout' | 'conflict' | 'unconfirmed'
 */
export async function uploadToUploadsBucket(path, file, { timeoutMs = 240000, client, fetchImpl } = {}) {
  const hybrid = client || (await import('../hybrid-supabase.js')).hybridSupabase;
  await hybrid.refreshUserHeader?.();
  const raw = hybrid.supabase;
  if (!raw?.storage) throw fail('upload_failed', 'The storage service is unavailable. Check your connection and try again.');
  const bucket = raw.storage.from('uploads');

  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(fail('timeout', 'The upload took too long.')), timeoutMs); });
  let existed = false;
  try {
    const sending = bucket.upload(path, file, { contentType: file.type, upsert: false });
    sending.catch(() => {}); // if the timeout wins, a later failure of this upload must not surface as an unhandled rejection
    const { error } = await Promise.race([sending, timeout]);
    if (error) {
      if (EXISTS.test(`${error.message || ''} ${error.statusCode || ''} ${error.error || ''}`)) existed = true;
      else throw fail('upload_failed', describeUploadError(error));
    }
  } catch (err) {
    if (err?.code === 'timeout' || err?.code === 'upload_failed') throw err;
    throw fail('upload_failed', describeUploadError(err));
  } finally { clearTimeout(timer); }

  const { data } = bucket.getPublicUrl(path);
  if (!data?.publicUrl) throw fail('upload_failed', 'The file was saved but its address could not be read.');
  let seen;
  try { seen = await verifyPublicFile(data.publicUrl, { fetchImpl }); } catch (err) { throw fail('unconfirmed', err?.message || 'The file was saved but could not be confirmed.'); }
  if (!seen.exists) throw fail('upload_failed', 'The file was not saved. Try again.');
  if (seen.size != null && seen.size !== file.size) {
    throw fail(existed ? 'conflict' : 'upload_failed', existed ? 'A different file already uses this name. Try again later.' : 'The saved file is not the size it should be. Try again.');
  }
  return { url: data.publicUrl, existed };
}
