-- Create uploads storage bucket
--
-- 5. New Storage Bucket
--    - uploads: Public bucket for user-uploaded reference images and videos
--    - File size limit: 100MB (matches process-upload edge function limit)
--    - Allowed MIME types: images, videos, audio, and PDFs
--
-- 2. Security
--    - Public read access so AI model endpoints can fetch uploaded files by URL
--    - Anonymous upload access since the app uses API keys (not Supabase Auth)
--    - Anonymous delete access for cleanup
--
-- 3. Notes
--    - This replaces the external API file upload endpoint that requires credits
--    - Files are stored with unique timestamped names to avoid collisions

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
   'uploads',
   true,
   104857600,
   ARRAY[
     'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
     'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
     'image/x-icon',
     'video/mp4', 'video/mpeg', 'video/webm', 'video/quicktime',
     'video/x-msvideo', 'video/x-matroska', 'video/x-flv',
     'video/x-ms-wmv', 'video/3gpp', 'video/ogg', 'video/x-m4v',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac',
    'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a',
    'audio/opus', 'audio/x-ms-wma', 'audio/aiff', 'audio/x-aiff',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Allow public read access on uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'uploads');

CREATE POLICY "Allow anonymous uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'uploads');

CREATE POLICY "Allow anonymous delete on uploads"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'uploads');
