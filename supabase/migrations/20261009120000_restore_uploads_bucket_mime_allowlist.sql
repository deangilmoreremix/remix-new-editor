-- Restore the full MIME allowlist on the `uploads` storage bucket.
--
-- REGRESSION FIX
-- --------------
-- Migration 20260803000000_allow_pdfs_in_uploads_bucket.sql rewrote
-- `storage.buckets.allowed_mime_types` for the `uploads` bucket in order to
-- add `application/pdf`. Its `ON CONFLICT DO UPDATE SET` replaced the whole
-- allowlist instead of extending it, so 47 MIME types that the application
-- still accepts were silently dropped:
--
--   * ALL audio types        (audio/mpeg, audio/wav, audio/mp3, audio/aac,
--                             audio/flac, audio/opus, audio/x-m4a, ...)
--   * image/bmp, image/tiff, image/heic, image/heif, image/avif, image/x-icon
--   * video/x-matroska(.mkv), video/x-flv, video/x-ms-wmv, video/3gpp,
--     video/ogg, video/x-m4v, video/mpeg
--   * every text type        (text/plain, application/json, text/csv,
--                             text/html, text/xml, text/vtt, text/srt, ...)
--   * every document type except PDF (doc/docx/xls/xlsx/ppt/pptx)
--   * every archive type     (zip/rar/7z/tar/gz/bz2)
--
-- The client-side validator (src/lib/editor/uploadLimits.js) still declares
-- all of these as valid — that file is the documented Single Source of Truth
-- for upload limits — so every affected upload passed client validation and
-- then failed at Supabase Storage with a MIME-not-allowed error. Audio
-- uploads were broken outright, which also affects `muapi.uploadFile`'s
-- Supabase fallback and CinemaStudio/TimelineEditorPage (hybrid-supabase.js).
--
-- This migration realigns the bucket with UPLOAD_MIME_TYPES. The 100MB
-- file_size_limit raised by 20260803000000 is preserved: MuAPI-bound
-- uploads are still capped by uploadLimits.js (images 10MB / videos 50MB /
-- audio+other 10MB) before they reach storage, so the bucket limit is not
-- the enforcement point for MuAPI limits.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  104857600,
  ARRAY[
    -- image (src/lib/editor/uploadLimits.js :: UPLOAD_MIME_TYPES.image)
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
    'image/x-icon',
    -- video (UPLOAD_MIME_TYPES.video) + video/mpeg for backward compatibility
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'video/webm', 'video/x-flv', 'video/x-ms-wmv', 'video/3gpp', 'video/ogg',
    'video/x-m4v', 'video/mpeg',
    -- audio (UPLOAD_MIME_TYPES.audio) — restored after being dropped
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/aac',
    'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a', 'audio/opus',
    'audio/x-ms-wma', 'audio/aiff', 'audio/x-aiff',
    -- document (UPLOAD_MIME_TYPES.document) — PDF + Office formats
    'application/pdf', 'application/msword', 'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    -- text (UPLOAD_MIME_TYPES.text) — subtitles, transcripts, data files
    'text/plain', 'text/markdown', 'application/json', 'text/csv',
    'application/xml', 'text/xml', 'text/html',
    'application/x-subrip', 'text/vtt', 'text/srt',
    -- archive (UPLOAD_MIME_TYPES.archive)
    'application/zip', 'application/x-zip-compressed',
    'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/gzip', 'application/x-tar', 'application/x-bzip2'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
    'image/x-icon',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'video/webm', 'video/x-flv', 'video/x-ms-wmv', 'video/3gpp', 'video/ogg',
    'video/x-m4v', 'video/mpeg',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/aac',
    'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a', 'audio/opus',
    'audio/x-ms-wma', 'audio/aiff', 'audio/x-aiff',
    'application/pdf', 'application/msword', 'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/markdown', 'application/json', 'text/csv',
    'application/xml', 'text/xml', 'text/html',
    'application/x-subrip', 'text/vtt', 'text/srt',
    'application/zip', 'application/x-zip-compressed',
    'application/x-rar-compressed', 'application/x-7z-compressed',
    'application/gzip', 'application/x-tar', 'application/x-bzip2'
  ];
