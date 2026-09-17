/**
 * Shared Upload Service
 *
 * Canonical upload path for image/video/audio/document files.
 * All studios should route uploads through this service instead of
 * calling `muapi.uploadFile` directly for media storage.
 *
 * Uploads go to Supabase Storage with user-scoped paths.
 * The returned URL can be passed to generation providers.
 */

import { supabase, isSupabaseConfigured, getSupabaseUrl, getSupabaseAnonKey } from './supabase.js';
import { UPLOAD_LIMITS, UPLOAD_MIME_TYPES, UPLOAD_EXTENSIONS, categoryFromMimeType, isAllowedMimeType, isAllowedExtension } from './editor/uploadLimits.js';

// Progress/cancel contract for callers:
// - onProgress: (loaded, total) => void
// - signal: AbortSignal

export class UploadError extends Error {
  constructor(message, { code, status, stage, cause } = {}) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.status = status;
    this.stage = stage; // 'validation' | 'upload' | 'url'
    this.cause = cause;
  }
}

function normalizeExtension(name) {
  if (!name || typeof name !== 'string') return 'bin';
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return 'bin';
  const parts = name.split('.');
  if (parts.length < 2) return 'bin';
  return parts.pop().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
}

function buildObjectPath(file, userId) {
  const ext = normalizeExtension(file.name);
  const safeBase = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80);
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const userPrefix = userId && userId !== 'anonymous' ? userId : 'anonymous';
  return `${userPrefix}/${unique}_${safeBase}.${ext}`;
}

export function resolveSupabaseBucket() {
  // Centralized bucket name for uploads. Keep this aligned with migrations.
  return 'uploads';
}

export function validateUploadFile(file, overrides) {
  const opts = { ...overrides };
  if (!file) throw new UploadError('No file selected.', { stage: 'validation', code: 'NO_FILE' });

  const declaredType = (file.type || '').toLowerCase();
  const inferredCategory = categoryFromMimeType(declaredType) || 'other';
  const category = opts.category || inferredCategory;

  const allowedMimes = UPLOAD_MIME_TYPES[category] || UPLOAD_MIME_TYPES.other;
  const allowedExts = UPLOAD_EXTENSIONS[category] || UPLOAD_EXTENSIONS.other;
  const maxSize = opts.maxSize ?? UPLOAD_LIMITS[category] ?? UPLOAD_LIMITS.other;

  const ext = normalizeExtension(file.name);
  if (!allowedExts.includes(ext)) {
    throw new UploadError(`Unsupported file extension: .${ext}`, { stage: 'validation', code: 'BAD_EXTENSION' });
  }

  if (declaredType && !isAllowedMimeType(declaredType, category)) {
    throw new UploadError(`Unsupported MIME type: ${declaredType}`, { stage: 'validation', code: 'BAD_MIME' });
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new UploadError('File is empty or corrupt.', { stage: 'validation', code: 'EMPTY_FILE' });
  }

  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024);
    throw new UploadError(`File is too large. Max ${maxMB}MB for ${category} uploads.`, {
      stage: 'validation',
      code: 'TOO_LARGE',
      status: 413,
    });
  }

  return {
    category,
    maxSize,
    extension: ext,
    declaredType: declaredType || `application/${ext}`,
  };
}

export async function uploadFileToSupabase(file, options = {}) {
  const { signal, onProgress, category, maxSize, userId } = options;

  if (!isSupabaseConfigured()) {
    throw new UploadError('Upload service is not configured. Missing Supabase environment variables.', {
      stage: 'upload',
      code: 'MISCONFIGURED',
    });
  }

  const validation = validateUploadFile(file, { category, maxSize });

  const objectPath = buildObjectPath(file, userId);
  const bucket = resolveSupabaseBucket();

  const uploadPromise = supabase.storage.from(bucket).upload(objectPath, file, {
    contentType: validation.declaredType,
    upsert: false,
  });

  const timeoutMs = 120000;
  const timeoutPromise = new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new UploadError('Upload timed out.', { stage: 'upload', code: 'TIMEOUT' })), timeoutMs);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new UploadError('Upload cancelled.', { stage: 'upload', code: 'CANCELLED' }));
      }, { once: true });
    }
  });

  let uploadResult;
  try {
    uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
  } catch (err) {
    const cause = err instanceof UploadError ? err.cause : err;
    const mapped = new UploadError(err.message || 'Upload failed.', {
      stage: 'upload',
      code: err.code || 'UPLOAD_FAILED',
      status: err.status || (cause?.status || cause?.code),
      cause,
    });
    throw mapped;
  }

  const { data: urlData, error: urlError } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  if (urlError || !urlData?.publicUrl) {
    throw new UploadError('Upload completed, but failed to retrieve file URL.', {
      stage: 'url',
      code: 'URL_MISSING',
      cause: urlError,
    });
  }

  return {
    url: urlData.publicUrl,
    path: objectPath,
    category: validation.category,
    size: file.size,
    mimeType: validation.declaredType,
    extension: validation.extension,
  };
}

/**
 * Convenience wrapper used by legacy callers that expect the old
 * `uploadFileToStorage(file)` signature.
 */
export async function uploadFileToStorage(file, options = {}) {
  return uploadFileToSupabase(file, options);
}
