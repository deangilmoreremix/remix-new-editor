-- Create projects + media tables so the app's hybrid-supabase data layer
-- (timeline editor, drag-drop, upload pipeline) stores real server-side data
-- instead of falling back to localStorage.
-- Schema matches the columns the app reads/writes (src/lib/hybrid-supabase.js
-- offlineQuery / syncProjectToRemote / syncMediaToRemote).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'anonymous',
  name text NOT NULL DEFAULT '',
  description text DEFAULT '',
  thumbnail_url text DEFAULT '',
  data jsonb DEFAULT '{}'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'active',
  tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

CREATE TABLE IF NOT EXISTS public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL DEFAULT 'anonymous',
  project_id text DEFAULT '',
  name text NOT NULL DEFAULT '',
  type text DEFAULT '',
  size bigint DEFAULT 0,
  path text DEFAULT '',
  url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_user_id ON public.media(user_id);
CREATE INDEX IF NOT EXISTS idx_media_project_id ON public.media(project_id);

-- The app uses the anon key and does not send the x-user-key header that the
-- other tables' policies require, so these tables use permissive anon RLS to
-- let the client read/write real data. Tighten later if per-user isolation is
-- needed (e.g. add user_key + x-user-key header in the supabase client).
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon full access to projects" ON public.projects;
CREATE POLICY "Allow anon full access to projects"
  ON public.projects FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon full access to media" ON public.media;
CREATE POLICY "Allow anon full access to media"
  ON public.media FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
