-- Fix RLS policies on content_library
--
-- The blanket "Allow anon full access" policy makes the specific
-- SELECT/INSERT/DELETE policies redundant and allows any anon or
-- authenticated user to UPDATE/DELETE any row. This migration
-- replaces it with a read-only anon policy and preserves the
-- row-level restrictions for authenticated users.

DROP POLICY IF EXISTS "Allow anon full access to content_library" ON public.content_library;
DROP POLICY IF EXISTS "Authenticated users can view content library" ON public.content_library;
DROP POLICY IF EXISTS "Authenticated users can upload to content library" ON public.content_library;
DROP POLICY IF EXISTS "Users can delete their own content library entries" ON public.content_library;
DROP POLICY IF EXISTS "Anon can view content library" ON public.content_library;

CREATE POLICY "Anon can view content library"
  ON public.content_library FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can view content library"
  ON public.content_library FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upload to content library"
  ON public.content_library FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own content library entries"
  ON public.content_library FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid()::text OR uploaded_by = 'anonymous');
