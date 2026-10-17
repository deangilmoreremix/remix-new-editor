-- ─────────────────────────────────────────────────────────────────────────────
-- SmartVideo (muapi upload feature) — APPLICATION-TAGGED media RLS
--
-- SHARED DATABASE CONTEXT
-- This Supabase project (bzxohkrxcwodllketcpz, "VideoRemix Product") is shared
-- by SEVERAL APPLICATIONS. Tables and buckets referenced here are shared
-- infrastructure: public.media, public.muapi_upload_cache and the `uploads`
-- storage bucket are used by other apps too. Every policy this migration adds
-- is named with the `smartvideo_` prefix and only governs rows/objects tagged
-- for THIS application (app_id = 'smartvideo' for tables; the `smartvideo/`
-- path prefix for storage objects). No statement here drops a table, a column,
-- a policy of another app, or any row belonging to another app.
--
-- VERSION COLLISION DISCOVERY (why this file exists)
-- The repo previously carried two migrations for this feature:
--   * 20261013000000_muapi_upload_workspace_isolation.sql — NEVER RAN. The
--     remote migration history version `20261013000000` was consumed by the
--     personalization app's migration (public.personalization_saved_projects
--     exists live; public.muapi_upload_cache does NOT; public.media has no
--     workspace_id column). `supabase db push` therefore skipped our file
--     silently — its intent (header/x-user-key scoping) never took effect.
--   * 20261013210000_tighten_identity_rls.sql — pending, never applied, and
--     superseded by this file.
-- Both files are deleted from the working tree and their intent is folded into
-- this migration. This file uses a fresh version (20261014120000, later than
-- the latest remote history version 20261014020100) so it cannot collide
-- again. It also does NOT replace the shared blanket policies with
-- header-scoped ones: it NARROWS them only for this app's tag, so the other
-- apps sharing public.media / the `uploads` bucket keep EXACTLY the access
-- they have today.
--
-- IDENTITY MODEL (verified Clerk identity, established in this project)
-- Requests carry either:
--   * a verified Supabase-compatible JWT minted by the supabase-token
--     function (role 'authenticated', `sub` = Clerk user id). The database
--     verifies the signature, so `auth.jwt() ->> 'sub'` is trustworthy;
--   * or the public anon key only (no verified JWT), in which case
--     `auth.jwt() ->> 'sub'` IS NULL and the caller is scoped strictly to the
--     shared 'anonymous' owner. Client-supplied headers are never consulted,
--     so they cannot be spoofed to reach another user's rows.
-- Workspace isolation for this app's rows (workspace_id = Clerk org id or
-- 'personal') is enforced APP-SIDE: every read is scoped by user + workspace
-- in src/lib/assetLibrary.js. The RLS boundary this migration enforces is the
-- IDENTITY (user boundary); workspace_id is carried on the row for app-side
-- scoping and is indexed for that purpose, but the database-level security
-- boundary is the verified user identity.
--
-- REQUIRED ENVIRONMENT (names only — values never live in the repo):
--   SUPABASE_JWT_SECRET            — Supabase project JWT secret (token
--                                    function + Supabase must share it)
--   CLERK_SECRET_KEY               — Clerk instance secret (JWKS verification)
--   CLERK_PUBLISHABLE_KEY          — Clerk publishable key
--   VITE_SUPABASE_TOKEN_FUNCTION_URL — token-exchange endpoint override
--
-- IDEMPOTENT: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- CREATE INDEX IF NOT EXISTS / DROP POLICY IF EXISTS + CREATE POLICY, and the
-- ALTER POLICY statements re-apply the same (already-narrowed) definition when
-- re-run. NOTE: `ALTER POLICY ... USING` requires the policy name to exist;
-- the three narrowed policies were verified live on 2026-10-14 (definitions
-- pasted in the sections below).
--
-- PRE-APPLY VERIFICATION (read-only, recommended for the lead):
--   select policyname, cmd, qual, with_check from pg_policies
--     where schemaname='public' and tablename='media';
--   -- expect exactly: "Allow anon full access to media" (ALL, true, true)
--   select policyname, cmd, qual, with_check from pg_policies
--     where schemaname='storage' and tablename='objects'
--       and (qual ilike '%uploads%' or with_check ilike '%uploads%');
--   -- expect exactly: "Allow anonymous uploads" (INSERT, null,
--   -- (bucket_id = 'uploads'::text)),
--   -- "Allow anonymous delete on uploads" (DELETE,
--   -- (bucket_id = 'uploads'::text, null)), "Allow public read access on
--   -- uploads" (SELECT, (bucket_id = 'uploads'::text, null)).
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ public.media: application tag + workspace columns ═══════════════════════
-- Both columns never existed live (verified 2026-10-14). app_id is nullable
-- with NO default so existing/shared rows keep app_id IS NULL and therefore
-- remain governed by the (narrowed) blanket policy — other apps are
-- unaffected. workspace_id is NOT NULL DEFAULT 'personal' (new rows of every
-- app default to 'personal'; the column is new, so no other app's write
-- supplies it and none is impacted).
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS app_id text;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS workspace_id text NOT NULL DEFAULT 'personal';

-- Backfill guard for rows created before the default existed. This is a
-- no-op by construction: the column is NOT NULL, so no row can hold NULL.
UPDATE public.media SET workspace_id = 'personal' WHERE workspace_id IS NULL;

-- Indexes backing this app's scoped reads (user + workspace) and tag lookups.
-- No live index collides with these names (live: media_pkey,
-- idx_media_user_id, idx_media_project_id).
CREATE INDEX IF NOT EXISTS idx_media_user_workspace ON public.media(user_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_media_app_id ON public.media(app_id);

-- ══ public.media: NARROW the shared blanket policy for OUR tag ══════════════
-- Current live definition (fetched 2026-10-14 via the read-only Management
-- API, project bzxohkrxcwodllketcpz):
--   policyname: "Allow anon full access to media"
--   cmd:        ALL
--   roles:      {anon,authenticated}
--   qual:       true
--   with_check: true
-- The policy is NARROWED — not replaced — so every other app keeps exactly
-- today's blanket access: their rows have app_id IS NULL (or any value other
-- than 'smartvideo'), for which `app_id IS DISTINCT FROM 'smartvideo'` is
-- TRUE. Only THIS app's tagged rows (app_id = 'smartvideo') fall out of the
-- blanket policy and are governed by smartvideo_media_owner_all below. The
-- roles are untouched ({anon,authenticated}).
-- Idempotent: re-running re-applies the identical definition. (ALTER POLICY
-- requires the policy name to exist — verified live as quoted above.)
ALTER POLICY "Allow anon full access to media" ON public.media
  USING (app_id IS DISTINCT FROM 'smartvideo')
  WITH CHECK (app_id IS DISTINCT FROM 'smartvideo');

-- ══ public.media: THIS APP's identity-scoped policy ═════════════════════════
-- Governs only rows tagged app_id = 'smartvideo' (the blanket policy above no
-- longer covers them). Identity boundary: the verified JWT `sub` when a
-- verified Supabase token is presented; strictly the shared 'anonymous'
-- owner when no verified JWT exists (auth.jwt() ->> 'sub' IS NULL). The
-- headerless branch can never match another user's row. Workspace isolation
-- (workspace_id) stays app-side: every read is additionally scoped by
-- user + workspace in src/lib/assetLibrary.js.
DROP POLICY IF EXISTS "smartvideo_media_owner_all" ON public.media;
CREATE POLICY "smartvideo_media_owner_all"
  ON public.media FOR ALL
  TO anon, authenticated
  USING (
    app_id = 'smartvideo'
    AND (
      user_id = auth.jwt() ->> 'sub'
      OR (auth.jwt() ->> 'sub' IS NULL AND user_id = 'anonymous')
    )
  )
  WITH CHECK (
    app_id = 'smartvideo'
    AND (
      user_id = auth.jwt() ->> 'sub'
      OR (auth.jwt() ->> 'sub' IS NULL AND user_id = 'anonymous')
    )
  );

-- ══ public.muapi_upload_cache: new table (does not exist live) ══════════════
-- Created exactly as the never-applied 20261013000000 migration defined it
-- (verified absent live on 2026-10-14). New table, so nothing shared exists
-- to disturb.
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

-- Verified-identity policy: JWT `sub` preferred; no verified JWT → strictly
-- the shared 'anonymous' owner (a headerless caller can touch nothing else).
DROP POLICY IF EXISTS "smartvideo_muapi_cache_owner_all" ON public.muapi_upload_cache;
CREATE POLICY "smartvideo_muapi_cache_owner_all"
  ON public.muapi_upload_cache FOR ALL
  TO anon, authenticated
  USING (
    user_id = auth.jwt() ->> 'sub'
    OR (auth.jwt() ->> 'sub' IS NULL AND user_id = 'anonymous')
  )
  WITH CHECK (
    user_id = auth.jwt() ->> 'sub'
    OR (auth.jwt() ->> 'sub' IS NULL AND user_id = 'anonymous')
  );

-- ══ storage.objects (shared `uploads` bucket) ════════════════════════════════
-- Current live definitions (fetched 2026-10-14 via the read-only Management
-- API):
--   "Allow anonymous uploads"              INSERT, TO {public},
--       with_check: (bucket_id = 'uploads'::text)                       [qual null]
--   "Allow anonymous delete on uploads"    DELETE, TO {public},
--       qual:       (bucket_id = 'uploads'::text)                       [with_check null]
--   "Allow public read access on uploads"  SELECT, TO {public},
--       qual:       (bucket_id = 'uploads'::text)                       [with_check null]
-- This app's objects are written at `smartvideo/${userId}/...`, so the first
-- path segment identifies the app tag and the second identifies the owner.
-- The shared INSERT/DELETE blanket policies are NARROWED — not replaced — to
-- exclude the `smartvideo/` prefix: every other app's object (first path
-- segment is that app's/folder's own value, or the file name for a
-- root-level object) still satisfies the blanket policies exactly as today.
-- Public read is deliberately untouched: AI providers fetch uploaded media by
-- URL, and this app's objects must stay publicly readable like every other
-- object in the bucket.
-- Idempotent: re-running re-applies the identical definitions. (ALTER POLICY
-- requires the policy names to exist — verified live as quoted above.)
ALTER POLICY "Allow anonymous uploads" ON storage.objects
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] IS DISTINCT FROM 'smartvideo'
  );

ALTER POLICY "Allow anonymous delete on uploads" ON storage.objects
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] IS DISTINCT FROM 'smartvideo'
  );

-- ══ storage.objects: THIS APP's tagged policies ═════════════════════════════
-- Govern only `smartvideo/`-prefixed objects in the shared `uploads` bucket:
-- the second path segment must equal the verified JWT `sub`, or strictly
-- 'anonymous' when no verified JWT is presented (coalesce fallback; the
-- client-supplied x-user-key header is never read, so it cannot be spoofed).
-- TO {public} mirrors the narrowed blanket policies' role coverage; only the
-- predicate is app-scoped.
DROP POLICY IF EXISTS "smartvideo_uploads_insert" ON storage.objects;
DROP POLICY IF EXISTS "smartvideo_uploads_delete" ON storage.objects;

CREATE POLICY "smartvideo_uploads_insert"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'smartvideo'
    AND (storage.foldername(name))[2] = coalesce(auth.jwt() ->> 'sub', 'anonymous')
  );

CREATE POLICY "smartvideo_uploads_delete"
  ON storage.objects FOR DELETE
  TO public
  USING (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = 'smartvideo'
    AND (storage.foldername(name))[2] = coalesce(auth.jwt() ->> 'sub', 'anonymous')
  );
