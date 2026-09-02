-- Content Library metadata table
--
-- Stores metadata for files uploaded to the global Content Library studio.
-- The actual files live in the 'uploads' storage bucket; this table tracks
-- filename, type, URL, size, uploader, and timestamps so the frontend can
-- list, filter, and search without scanning storage.

CREATE TABLE IF NOT EXISTS public.content_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  type text NOT NULL CHECK (type IN ('pdf', 'video')),
  url text NOT NULL,
  storage_path text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  uploaded_by text DEFAULT 'anonymous',
  title text DEFAULT '',
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_library_type ON public.content_library(type);
CREATE INDEX IF NOT EXISTS idx_content_library_created_at ON public.content_library(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_library_uploaded_by ON public.content_library(uploaded_by);

ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;

-- Public read — global library, all authenticated users can view
CREATE POLICY "Authenticated users can view content library"
  ON public.content_library FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can upload
CREATE POLICY "Authenticated users can upload to content library"
  ON public.content_library FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can delete their own uploads
CREATE POLICY "Users can delete their own content library entries"
  ON public.content_library FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid()::text OR uploaded_by = 'anonymous');

-- Allow anon full access for now (matches existing projects/media pattern)
CREATE POLICY "Allow anon full access to content_library"
  ON public.content_library FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
