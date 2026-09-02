/**
 * Upload Limits — Single Source of Truth
 *
 * Centralized file size limits, MIME types, and upload configuration.
 * Every file that needs upload limits MUST import from this file.
 *
 * This prevents the regression pattern where limits drift across:
 *   - validateFile.js (FILE_TYPE_CONFIG)
 *   - UploadPicker.js (MUAPI_LIMITS)
 *   - dragDrop.js (FILE_TYPES)
 *   - muapi.js (inline maxSize)
 *   - muapi-proxy/index.ts (MAX_IMAGE_BYTES, MAX_VIDEO_BYTES)
 *
 * MuAPI documentation: https://muapi.ai/docs/file-upload
 * Limits: Images 10MB · Videos 50MB · Audio 10MB · Others 10MB
 */

// Supabase Edge Function body limit (~10MB runtime cap).
// Files larger than this threshold bypass the proxy and upload directly.
export const SUPABASE_PROXY_BODY_LIMIT_BYTES = 8 * 1024 * 1024; // 8MB safe threshold

// Per-type size limits (bytes) — matches MuAPI's documented limits
export const UPLOAD_LIMITS = {
  image: 10 * 1024 * 1024,   // 10MB
  video: 50 * 1024 * 1024,   // 50MB
  audio: 10 * 1024 * 1024,   // 10MB
  document: 10 * 1024 * 1024, // 10MB
  text: 10 * 1024 * 1024,    // 10MB
  archive: 10 * 1024 * 1024, // 10MB
  other: 10 * 1024 * 1024,   // 10MB
};

// Maximum buffer size for the Supabase proxy (100MB declared, but runtime caps at ~10MB)
export const MAX_PROXY_BUFFER_BYTES = 100 * 1024 * 1024;

// Allowed MIME types per category
export const UPLOAD_MIME_TYPES = {
  image: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
    'image/x-icon'
  ],
  video: [
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'video/webm', 'video/x-flv', 'video/x-ms-wmv', 'video/3gpp', 'video/ogg',
    'video/x-m4v'
  ],
  audio: [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/aac',
    'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a', 'audio/opus',
    'audio/x-ms-wma', 'audio/aiff', 'audio/x-aiff'
  ],
  document: [
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
  text: [
    'text/plain', 'text/markdown', 'application/json', 'text/csv',
    'application/xml', 'text/xml', 'text/html', 'application/x-subrip',
    'text/vtt', 'text/srt'
  ],
  archive: [
    'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
    'application/x-7z-compressed', 'application/gzip', 'application/x-tar',
    'application/x-bzip2'
  ]
};

// Allowed extensions per category
export const UPLOAD_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic', 'avif'],
  video: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'flv', 'wmv', '3gp', 'ogv'],
  audio: ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a', 'opus', 'wma', 'aiff', 'aif'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'],
  text: ['txt', 'md', 'json', 'csv', 'xml', 'html', 'htm', 'srt', 'vtt', 'ass'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2']
};

// Retry configuration
export const UPLOAD_RETRY_CONFIG = {
  maxRetries: 2,
  retryableStatuses: [502, 503, 429],
  baseBackoffMs: 1000,
  maxBackoffMs: 4000,
};

// Timeout configuration (ms)
export const UPLOAD_TIMEOUT_MS = 60000;        // Standard uploads
export const UPLOAD_LARGE_TIMEOUT_MS = 120000; // Direct uploads (>8MB)
export const METADATA_EXTRACTION_TIMEOUT_MS = 5000;

// Rate limiting
export const RATE_LIMIT_MAX = 100;              // requests per window
export const RATE_LIMIT_WINDOW_MS = 60000;      // 1 minute

/**
 * Get the size limit for a given file category.
 * @param {string} category - 'image' | 'video' | 'audio' | 'document' | 'text' | 'archive'
 * @returns {number} size limit in bytes
 */
export function getUploadLimit(category) {
  return UPLOAD_LIMITS[category] || UPLOAD_LIMITS.other;
}

/**
 * Check if a file type is allowed for a given category.
 * @param {string} mimeType - The file's MIME type
 * @param {string} category - The upload category
 * @returns {boolean}
 */
export function isAllowedMimeType(mimeType, category) {
  const allowed = UPLOAD_MIME_TYPES[category];
  if (!allowed) return false;
  return allowed.includes(mimeType.toLowerCase());
}

/**
 * Check if a file extension is allowed for a given category.
 * @param {string} extension - The file extension (without dot)
 * @param {string} category - The upload category
 * @returns {boolean}
 */
export function isAllowedExtension(extension, category) {
  const allowed = UPLOAD_EXTENSIONS[category];
  if (!allowed) return false;
  return allowed.includes(extension.toLowerCase());
}

/**
 * Detect the upload category from a MIME type.
 * @param {string} mimeType
 * @returns {string} category
 */
export function categoryFromMimeType(mimeType) {
  if (!mimeType) return 'other';
  const m = mimeType.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf' || m.includes('msword') || m.includes('officedocument')) return 'document';
  if (m.startsWith('text/') || m === 'application/json' || m === 'application/xml') return 'text';
  if (m.includes('zip') || m.includes('rar') || m.includes('tar') || m.includes('gzip')) return 'archive';
  return 'other';
}
