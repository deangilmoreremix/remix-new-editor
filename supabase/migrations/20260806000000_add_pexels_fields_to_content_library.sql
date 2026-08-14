-- Add Pexels metadata fields to content_library
-- Supports stock media imports with attribution and media dimensions

ALTER TABLE public.content_library
  ADD COLUMN IF NOT EXISTS attribution text DEFAULT '',
  ADD COLUMN IF NOT EXISTS pexels_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'pexels',
  ADD COLUMN IF NOT EXISTS thumb text DEFAULT '',
  ADD COLUMN IF NOT EXISTS width integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS height integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration float DEFAULT 0;

-- Drop and recreate the type CHECK constraint to allow 'image'
ALTER TABLE public.content_library DROP CONSTRAINT IF EXISTS content_library_type_check;
ALTER TABLE public.content_library
  ADD CONSTRAINT content_library_type_check CHECK (type IN ('pdf', 'video', 'image'));

-- Index for pexels imports
CREATE INDEX IF NOT EXISTS idx_content_library_source ON public.content_library(source);
