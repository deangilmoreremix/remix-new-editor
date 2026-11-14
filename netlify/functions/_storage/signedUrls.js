/**
 * Signed URLs for the private `recipient-videos` bucket via Supabase Storage's REST API (service role, server only; dependency-free).
 * The service key never leaves the server: the browser only ever receives a signed URL that expires.
 */
export const BUCKET = 'recipient-videos';
export const DOWNLOAD_SECONDS = 3600;
const PATH = /^[A-Za-z0-9_-]{8,32}\/[0-9a-f-]{36}\/[0-9a-f]{32}\.(mp4|webm)$/;
export const isObjectPath = (p) => typeof p === 'string' && p.length < 200 && PATH.test(p);
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const base = (url) => String(url).replace(/\/$/, '') + '/storage/v1';

async function post(cfg, endpoint, body, fetchImpl) {
  const res = await fetchImpl(`${base(cfg.url)}/${endpoint}`, { method: 'POST', redirect: 'manual', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`storage ${endpoint.split('/')[1]} failed (HTTP ${res.status})`);
  return res.json();
}
/** A short-lived URL a browser can GET to stream one object. */
export async function signDownload(cfg, path, expiresIn = DOWNLOAD_SECONDS, fetchImpl = fetch) {
  if (!isObjectPath(path)) throw new Error('refusing to sign an unexpected object path');
  const j = await post(cfg, `object/sign/${BUCKET}/${enc(path)}`, { expiresIn }, fetchImpl);
  const rel = j?.signedURL ?? j?.signedUrl; if (typeof rel !== 'string' || !rel.startsWith('/')) throw new Error('storage returned no signed URL');
  return `${base(cfg.url)}${rel}`;
}
/** A URL (valid about two hours) the owner's browser can PUT one file to, for exactly this path. */
export async function signUpload(cfg, path, fetchImpl = fetch) {
  if (!isObjectPath(path)) throw new Error('refusing to sign an unexpected object path');
  const j = await post(cfg, `object/upload/sign/${BUCKET}/${enc(path)}`, {}, fetchImpl);
  const rel = j?.url; if (typeof rel !== 'string' || !rel.startsWith('/')) throw new Error('storage returned no upload URL');
  return `${base(cfg.url)}${rel}`;
}
/** Deletes an object (best effort: a missing object is fine). */
export async function removeObject(cfg, path, fetchImpl = fetch) {
  if (!isObjectPath(path)) return false;
  const res = await fetchImpl(`${base(cfg.url)}/object/${BUCKET}/${enc(path)}`, { method: 'DELETE', redirect: 'manual', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(8000) });
  return res.ok || res.status === 404;
}
/** Size of a stored object from the storage service (never from the client): HEAD on the authenticated object URL. */
export async function objectSize(cfg, path, fetchImpl = fetch) {
  if (!isObjectPath(path)) return null;
  const res = await fetchImpl(`${base(cfg.url)}/object/info/${BUCKET}/${enc(path)}`, { method: 'GET', redirect: 'manual', headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const j = await res.json().catch(() => null); const n = Number(j?.size ?? j?.metadata?.size);
  return Number.isFinite(n) && n > 0 ? n : null;
}
