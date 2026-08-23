-- Allow PDFs in the existing uploads bucket
--
-- The existing uploads bucket was created with MIME types restricted to
-- images and videos. The new Content Library needs to accept PDFs as well.
--
-- This migration updates the bucket's allowed_mime_types to include
-- application/pdf and raises the file size limit to 100MB to accommodate
-- large webinar recordings and document packages.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  104857600,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'application/pdf'
  ];
