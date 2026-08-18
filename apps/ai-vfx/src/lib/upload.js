import { uploadFile as muapiUploadFile } from './muapi'

// ---------------------------------------------------------------------------
// Image upload module for the AI VFX Studio
//
// Provides a single, robust entry point for turning a user-selected File into
// a URL the rest of the app can use (generation, image-to-video). It layers
// on top of the existing MuAPI upload endpoint with:
//   - client-side validation (type + size) before any network call
//   - upload progress reporting (XHR, since fetch offers no upload progress)
//   - automatic retry with backoff on transient failures
//   - object-URL lifecycle management so previews don't leak memory
//   - tolerant response parsing across MuAPI's varying response shapes
//
// A Supabase fallback exists for environments that configure it, but the
// studio ships with placeholder Supabase creds, so MuAPI is the default.
// ---------------------------------------------------------------------------

export const UPLOAD_CONSTRAINTS = {
  // Image MIME types we accept. Kept conservative — the VFX pipeline only
  // needs raster images; rejecting others early avoids wasted uploads.
  acceptedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif'],
  acceptedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'],
  // 15 MB cap. MuAPI's object store rejects very large bodies; this keeps
  // uploads snappy and fails fast with a clear message instead of a 413.
  maxSizeBytes: 15 * 1024 * 1024,
  maxRetries: 2,
}

function extOf(name = '') {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

export function validateImageFile(file) {
  if (!file) return { ok: false, error: 'No file selected.' }
  if (!(file instanceof Blob) && typeof file.size !== 'number') {
    return { ok: false, error: 'Selected item is not a valid file.' }
  }

  const type = file.type || ''
  const ext = extOf(file.name)

  const typeOk = UPLOAD_CONSTRAINTS.acceptedTypes.includes(type) ||
    (!type && UPLOAD_CONSTRAINTS.acceptedExtensions.includes(ext))
  if (!typeOk) {
    return {
      ok: false,
      error: `Unsupported file type. Please choose an image (${UPLOAD_CONSTRAINTS.acceptedExtensions.join(', ')}).`,
    }
  }

  if (file.size > UPLOAD_CONSTRAINTS.maxSizeBytes) {
    const mb = (UPLOAD_CONSTRAINTS.maxSizeBytes / (1024 * 1024)).toFixed(0)
    return {
      ok: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is ${mb} MB.`,
    }
  }

  if (file.size === 0) {
    return { ok: false, error: 'That file appears to be empty.' }
  }

  return { ok: true }
}

// Normalize the MuAPI upload response into a guaranteed string URL. The
// endpoint has historically returned the URL under several keys; tolerate
// all of them so a working upload never surfaces as an error.
function extractUploadUrl(payload) {
  if (!payload || typeof payload !== 'object') return null
  return (
    payload.url ||
    payload.data?.url ||
    payload.file_url ||
    payload.fileUrl ||
    payload.public_url ||
    payload.publicUrl ||
    (typeof payload.data === 'string' ? payload.data : null) ||
    null
  )
}

// Upload with XHR so we can report progress. Falls back to the fetch-based
// muapiUploadFile when no onProgress callback is supplied. Retries transient
// (network / 5xx / 429) failures with a small backoff.
export async function uploadImageFile(file, { onProgress, signal } = {}) {
  const validation = validateImageFile(file)
  if (!validation.ok) {
    const err = new Error(validation.error)
    err.code = 'VALIDATION'
    throw err
  }

  const apiKey = import.meta.env.VITE_MUAPI_KEY
  if (!apiKey) {
    const err = new Error('Upload is not available: VITE_MUAPI_KEY is not configured.')
    err.code = 'NO_API_KEY'
    throw err
  }

  let lastError = null
  for (let attempt = 0; attempt <= UPLOAD_CONSTRAINTS.maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 400 * attempt))
      onProgress?.(0, { phase: 'retrying', attempt })
    }
    try {
      const url = onProgress
        ? await uploadWithProgress(file, apiKey, onProgress, signal)
        : await muapiUploadFile(file).then(extractUploadUrl)
      if (!url) throw new Error('Upload failed: no URL returned by server.')
      return url
    } catch (err) {
      lastError = err
      // Don't retry client/validation errors or aborts.
      if (err.code === 'VALIDATION' || err.code === 'NO_API_KEY' || err.name === 'AbortError') break
      const status = err.status
      if (status && (status === 400 || status === 401 || status === 402 || status === 403 || status === 413)) break
      // Otherwise treat as transient and retry.
    }
  }
  lastError.code = lastError.code || 'UPLOAD_FAILED'
  throw lastError
}

function uploadWithProgress(file, apiKey, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file, file.name)

    xhr.open('POST', 'https://api.muapi.ai/api/v1/upload_file')

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100)
        onProgress?.(pct, { phase: 'uploading' })
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText)
          const url = extractUploadUrl(body)
          if (url) {
            onProgress?.(100, { phase: 'done' })
            resolve(url)
          } else {
            reject(Object.assign(new Error('Upload failed: no URL returned by server.'), { status: xhr.status }))
          }
        } catch {
          reject(Object.assign(new Error('Upload failed: invalid server response.'), { status: xhr.status }))
        }
      } else {
        const isAuthCredit = xhr.status === 401 || xhr.status === 402 || xhr.status === 403
        const message = isAuthCredit
          ? 'Please sign in and add api credits.'
          : `Upload failed (${xhr.status}).`
        reject(Object.assign(new Error(message), { status: xhr.status }))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload.'))
    })
    xhr.addEventListener('abort', () => {
      const err = new Error('Upload cancelled.')
      err.name = 'AbortError'
      reject(err)
    })
    xhr.addEventListener('timeout', () => {
      reject(Object.assign(new Error('Upload timed out.'), { status: 0 }))
    })

    xhr.setRequestHeader('x-api-key', apiKey)
    xhr.send(formData)

    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
  })
}

// --- Local preview (object URL) lifecycle -----------------------------------
// Object URLs must be revoked to avoid leaking memory. Track the last one
// issued for a given owner key and revoke it before issuing a new one.
const previewUrls = new Map()

export function createPreviewUrl(file, ownerKey = 'default') {
  const prev = previewUrls.get(ownerKey)
  if (prev) URL.revokeObjectURL(prev)
  const url = URL.createObjectURL(file)
  previewUrls.set(ownerKey, url)
  return url
}

export function revokePreviewUrl(ownerKey = 'default') {
  const url = previewUrls.get(ownerKey)
  if (url) {
    URL.revokeObjectURL(url)
    previewUrls.delete(ownerKey)
  }
}
