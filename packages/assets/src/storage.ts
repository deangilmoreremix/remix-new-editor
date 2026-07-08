// packages/assets/src/storage.ts
//
// Supabase storage adapter for the assets package. The package can be
// used without storage (source-only mode for fast discovery) but when
// the `uploadToStorage` flag is set, discovered assets are downloaded
// from their source URL and re-uploaded to a Supabase storage bucket so
// the URLs are stable (source URLs can disappear or 404).
//
// Env vars (server-side / Netlify functions only — never expose the
// service key to the browser):
//   SUPABASE_URL          — project URL
//   SUPABASE_SERVICE_ROLE_KEY — service role key
//   ASSETS_BUCKET         — bucket name (default: "contact-assets")
//
// The browser path can use the public anon key with a read-only bucket.

import type { StorageConfig, UploadResult } from './types.ts';

const DEFAULT_BUCKET = 'contact-assets';
const MAX_RETRIES = 2;

function getEnv(name: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[name];
    }
  } catch {}
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[name];
  }
  return undefined;
}

export function getStorageConfig(overrides: Partial<StorageConfig> = {}): StorageConfig {
  const supabaseUrl = overrides.supabaseUrl || getEnv('SUPABASE_URL') || '';
  const supabaseServiceKey =
    overrides.supabaseServiceKey || getEnv('SUPABASE_SERVICE_ROLE_KEY') || getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY') || '';
  const bucket = overrides.bucket || getEnv('ASSETS_BUCKET') || DEFAULT_BUCKET;
  return { supabaseUrl, supabaseServiceKey, bucket };
}

export function isStorageConfigured(cfg: StorageConfig): boolean {
  return Boolean(cfg.supabaseUrl && cfg.supabaseServiceKey && cfg.bucket);
}

/**
 * Upload a binary blob to Supabase storage and return the public URL.
 *
 * @param cfg        - storage config
 * @param storagePath - path within the bucket, e.g. "contacts/abc/avatar.png"
 * @param body       - raw bytes
 * @param contentType - MIME type
 * @param upsert     - overwrite if exists (default: true)
 */
export async function uploadBytes(
  cfg: StorageConfig,
  storagePath: string,
  body: Uint8Array,
  contentType?: string,
  upsert: boolean = true,
): Promise<UploadResult> {
  if (!isStorageConfigured(cfg)) {
    throw new Error('Supabase storage is not configured (missing SUPABASE_URL or key)');
  }
  const url = `${cfg.supabaseUrl}/storage/v1/object/${encodeURIComponent(cfg.bucket)}/${storagePath}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseServiceKey,
        Authorization: `Bearer ${cfg.supabaseServiceKey}`,
        'Content-Type': contentType || 'application/octet-stream',
        'x-upsert': upsert ? 'true' : 'false',
      },
      body,
    });
    if (res.ok) {
      return {
        url: getPublicUrl(cfg, storagePath),
        storagePath,
        size: body.byteLength,
        contentType,
      };
    }
    const text = await res.text().catch(() => '');
    lastErr = new Error(`Supabase upload failed (${res.status}): ${text.slice(0, 500)}`);
    if (res.status < 500 && res.status !== 429) break;
  }
  throw lastErr ?? new Error('Upload failed');
}

/**
 * Download a URL as a Uint8Array with size + timeout guards.
 */
export async function downloadBytes(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number; userAgent?: string } = {},
): Promise<{ body: Uint8Array; contentType?: string; size: number }> {
  const { timeoutMs = 10000, maxBytes = 5 * 1024 * 1024, userAgent = 'Mozilla/5.0 (compatible; remix-new-editor-assets/1.0)' } = opts;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent }, signal: controller.signal });
    if (!res.ok) throw new Error(`download failed (${res.status}) for ${url}`);

    const contentType = res.headers.get('content-type') || undefined;
    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > maxBytes) {
      throw new Error(`asset too large (${contentLength} bytes > ${maxBytes} limit)`);
    }

    // Read with a streaming size guard
    if (!res.body) {
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > maxBytes) throw new Error('asset too large');
      return { body: buf, contentType, size: buf.byteLength };
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          throw new Error(`asset too large (>${maxBytes} bytes)`);
        }
        chunks.push(value);
      }
    }
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { body, contentType, size: total };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build the public URL for an object in the bucket.
 */
export function getPublicUrl(cfg: StorageConfig, storagePath: string): string {
  return `${cfg.supabaseUrl}/storage/v1/object/public/${cfg.supabaseUrl ? cfg.bucket : ''}/${storagePath}`;
}

/**
 * Delete an object from the bucket. No-op if storage is not configured.
 */
export async function deleteObject(cfg: StorageConfig, storagePath: string): Promise<void> {
  if (!isStorageConfigured(cfg)) return;
  const url = `${cfg.supabaseUrl}/storage/v1/object/${encodeURIComponent(cfg.bucket)}/${storagePath}`;
  await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: cfg.supabaseServiceKey,
      Authorization: `Bearer ${cfg.supabaseServiceKey}`,
    },
  });
}

/**
 * List objects under a prefix. Returns up to `limit` storage paths.
 */
export async function listObjects(
  cfg: StorageConfig,
  prefix: string,
  limit: number = 100,
): Promise<string[]> {
  if (!isStorageConfigured(cfg)) return [];
  const url = `${cfg.supabaseUrl}/storage/v1/object/list/${encodeURIComponent(cfg.bucket)}?prefix=${encodeURIComponent(prefix)}&limit=${limit}`;
  const res = await fetch(url, {
    headers: {
      apikey: cfg.supabaseServiceKey,
      Authorization: `Bearer ${cfg.supabaseServiceKey}`,
    },
  });
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data.map((o: any) => o.name).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Download a source URL and re-upload to Supabase. Returns the new public URL
 * + storage path. Falls back to the source URL on any error.
 */
export async function mirrorToStorage(
  cfg: StorageConfig,
  sourceUrl: string,
  storagePath: string,
  opts: { timeoutMs?: number; maxBytes?: number; userAgent?: string } = {},
): Promise<UploadResult> {
  const { body, contentType, size } = await downloadBytes(sourceUrl, opts);
  return uploadBytes(cfg, storagePath, body, contentType);
}

/**
 * Build a deterministic storage path for a contact asset.
 * Format: contacts/{userId}/{contactId}/{type}/{filename}
 */
export function buildContactAssetPath(
  userId: string,
  contactId: string,
  assetType: string,
  filename: string,
): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `contacts/${safe(userId)}/${safe(contactId)}/${assetType}/${safe(filename)}`;
}
