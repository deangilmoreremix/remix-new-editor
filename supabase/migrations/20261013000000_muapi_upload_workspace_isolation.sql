-- MuAPI upload workspace isolation
--
-- Adds per-user/per-workspace scoping to the media pipeline and creates a
-- dedicated cache table for MuAPI uploads. The RLS idiom is the one already
-- used by the core tables in 20260310081146_create_core_tables.sql: the
-- caller identity arrives in the `x-user-key` request header and is matched
-- with
--   current_setting('request.headers', true)::json->>'x-user-key'
--
-- Backward compatibility: the shared Supabase client and hybrid-supabase now
-- attach `x-user-key` to every request (refreshed per call, since the Clerk
-- identity can change at runtime). When no header is present the caller is
-- treated as the shared 'anonymous' owner — the app's legacy local identity —
-- so anonymous local flows keep working without granting access to any
-- authenticated user's rows. The muapi_upload_cache table is strictly
-- header-scoped: no header, no access.

-- Idempotent: safe to re-run.

-- 1. media: workspace scoping column
ALTER TABLE public.media
  ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'personal';

-- Backfill guard for rows created before the default existed (no-op when
-- the default already applied).
UPDATE public.media SET workspace_id = 'personal' WHERE workspace_id IS NULL;

-- 2. MuAPI upload cache: per-user, per-workspace asset cache
CREATE TABLE IF NOT EXISTS public.muapi_upload_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  workspace_id text NOT NULL DEFAULT 'personal',
  asset_id text NOT NULL,
  category text,
  url text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (user_id, workspace_id, asset_id)
);

ALTER TABLE public.muapi_upload_cache ENABLE ROW LEVEL SECURITY;

-- The unique constraint above already indexes (user_id, workspace_id, asset_id)
-- for upsert/lookup paths; add an explicit lookup index for expiry sweeps.
CREATE INDEX IF NOT EXISTS idx_muapi_upload_cache_user_workspace_asset
  ON public.muapi_upload_cache(user_id, workspace_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_muapi_upload_cache_expires_at
  ON public.muapi_upload_cache(expires_at);

-- 3. media policies: replace the blanket USING (true) policy with
--    header-scoped policies. The caller identity is the `x-user-key` header
--    (the shared Supabase client and hybrid-supabase both attach it on every
--    request now). When no header is present the caller is treated as the
--    shared 'anonymous' owner — the app's legacy local identity — instead of
--    matching every row, so cross-user access is always denied. Presenting a
--    different user's id never grants access to their rows.
DROP POLICY IF EXISTS "Allow anon full access to media" ON public.media;

CREATE POLICY "Users can access own media rows"
  ON public.media FOR ALL
  TO anon, authenticated
  USING (
    user_id = coalesce(
      current_setting('request.headers', true)::json->>'x-user-key',
      'anonymous'
    )
  )
  WITH CHECK (
    user_id = coalesce(
      current_setting('request.headers', true)::json->>'x-user-key',
      'anonymous'
    )
  );

-- 4. muapi_upload_cache policies: strictly scoped to the caller's user id.
CREATE POLICY "Users can read own muapi upload cache"
  ON public.muapi_upload_cache FOR SELECT
  TO anon, authenticated
  USING (
    user_id = current_setting('request.headers', true)::json->>'x-user-key'
  );

CREATE POLICY "Users can insert own muapi upload cache"
  ON public.muapi_upload_cache FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id = current_setting('request.headers', true)::json->>'x-user-key'
  );

CREATE POLICY "Users can update own muapi upload cache"
  ON public.muapi_upload_cache FOR UPDATE
  TO anon, authenticated
  USING (
    user_id = current_setting('request.headers', true)::json->>'x-user-key'
  )
  WITH CHECK (
    user_id = current_setting('request.headers', true)::json->>'x-user-key'
  );

CREATE POLICY "Users can delete own muapi upload cache"
  ON public.muapi_upload_cache FOR DELETE
  TO anon, authenticated
  USING (
    user_id = current_setting('request.headers', true)::json->>'x-user-key'
  );

-- 5. uploads storage bucket: keep public read (AI providers fetch uploaded
--    media by URL — that is the documented bucket design) but stop anonymous
--    callers from writing into or deleting other owners' prefixes. Every
--    writer in the app stores objects under `${getUserKey()}/...`, so the
--    first path segment is the owner identity.
DROP POLICY IF EXISTS "Allow anonymous uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous delete on uploads" ON storage.objects;

CREATE POLICY "Owners can upload own uploads objects"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = coalesce(
      current_setting('request.headers', true)::json->>'x-user-key',
      'anonymous'
    )
  );

CREATE POLICY "Owners can delete own uploads objects"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = coalesce(
      current_setting('request.headers', true)::json->>'x-user-key',
      'anonymous'
    )
  );
