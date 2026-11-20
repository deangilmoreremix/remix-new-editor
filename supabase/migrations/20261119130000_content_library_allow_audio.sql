-- Allow 'audio' in content_library.type.
-- The app (contentLibrary.js inferType, ContentLibraryPage audio filter) treats
-- audio as a content type, but the CHECK constraint only allowed pdf/video/image.

ALTER TABLE public.content_library DROP CONSTRAINT IF EXISTS content_library_type_check;
ALTER TABLE public.content_library
  ADD CONSTRAINT content_library_type_check CHECK (type IN ('pdf', 'video', 'image', 'audio'));
