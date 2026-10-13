-- Tighten identity RLS: verified Clerk identity (auth.jwt() ->> 'sub')
-- preferred, client-controlled header restricted to anonymous fallback.
--
-- Replaces the policies from 20261013000000_muapi_upload_workspace_isolation.sql.
-- That migration scoped media / muapi_upload_cache / uploads-bucket access to
-- the `x-user-key` request header. That header is client-controlled: any holder
-- of the public anon key could send any user's id and read/write/delete that
-- user's rows. It is not a security boundary.
--
-- The fix follows the standard Supabase + Clerk pattern:
--
--   1. netlify/functions/supabase-token.js verifies the caller's Clerk session
--      JWT against the Clerk JWKS and mints a short-lived Supabase-compatible
--      JWT (HS256, signed with SUPABASE_JWT_SECRET) whose `sub` claim is the
--      Clerk user id and whose `workspace_id` claim is the Clerk org id or
--      'personal'.
--   2. The browser client (src/lib/supabase.js) sends that token as
--      `Authorization: Bearer <jwt>`; the database itself verifies the
--      signature, so `auth.jwt() ->> 'sub'` is a trustworthy identity.
--   3. These policies prefer that verified identity. When NO verified JWT is
--      present the caller is scoped to the shared 'anonymous' owner — the
--      client-supplied x-user-key header is NOT read at all, so it cannot be
--      spoofed to reach another user's rows. Signed-in users always present a
--      verified JWT, so their rows are reachable only through their own token.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY only. No destructive
-- statements, no table drops, no data changes.
--
-- Required environment to activate the verified path (values never live in
-- the repo):
--   SUPABASE_JWT_SECRET  — Supabase project JWT secret (Netlify function +
--                          Supabase must share it)
--   CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY — Clerk instance for JWKS
--   VITE_SUPABASE_TOKEN_FUNCTION_URL      — optional override; defaults to
--                          https://<site>/.netlify/functions/supabase-token

-- ─── media ──────────────────────────────────────────────────────────────────
-- One policy for ALL commands: prefer the verified JWT subject; when no JWT
-- is presented, honour the header-derived owner ('anonymous' when absent).
-- A verified caller can never be re-scoped by a tampered header, because the
-- The headerless branch is only reachable when auth.jwt() ->> 'sub' IS NULL
-- and grants nothing but the shared 'anonymous' owner.
DROP POLICY IF EXISTS "Users can access own media rows" ON public.media;

CREATE POLICY "Users can access own media rows"
  ON public.media FOR ALL
  TO anon, authenticated
  USING (
    user_id = auth.jwt() ->> 'sub'
    OR (
      auth.jwt() ->> 'sub' IS NULL
      AND user_id = 'anonymous'
    )
  )
  WITH CHECK (
    user_id = auth.jwt() ->> 'sub'
    OR (
      auth.jwt() ->> 'sub' IS NULL
      AND user_id = 'anonymous'
    )
  );

-- ─── muapi_upload_cache ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can read own muapi upload cache" ON public.muapi_upload_cache;
DROP POLICY IF EXISTS "Users can insert own muapi upload cache" ON public.muapi_upload_cache;
DROP POLICY IF EXISTS "Users can update own muapi upload cache" ON public.muapi_upload_cache;
DROP POLICY IF EXISTS "Users can delete own muapi upload cache" ON public.muapi_upload_cache;

CREATE POLICY "Users can read own muapi upload cache"
  ON public.muapi_upload_cache FOR SELECT
  TO anon, authenticated
  USING (
    user_id = auth.jwt() ->> 'sub'
    OR (
      auth.jwt() ->> 'sub' IS NULL
      AND user_id = 'anonymous'
    )
  );

CREATE POLICY "Users can insert own muapi upload cache"
  ON public.muapi_upload_cache FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    user_id = auth.jwt() ->> 'sub'
    OR (
      auth.jwt() ->> 'sub' IS NULL
      AND user_id = 'anonymous'
    )
  );

CREATE POLICY "Users can update own muapi upload cache"
  ON public.muapi_upload_cache FOR UPDATE
  TO anon, authenticated
  USING (
    user_id = auth.jwt() ->> 'sub'
    OR (
      auth.jwt() ->> 'sub' IS NULL
      AND user_id = 'anonymous'
    )
  )
  WITH CHECK (
    user_id = auth.jwt() ->> 'sub'
    OR (
      auth.jwt() ->> 'sub' IS NULL
      AND user_id = 'anonymous'
    )
  );

CREATE POLICY "Users can delete own muapi upload cache"
  ON public.muapi_upload_cache FOR DELETE
  TO anon, authenticated
  USING (
    user_id = auth.jwt() ->> 'sub'
    OR (
      auth.jwt() ->> 'sub' IS NULL
      AND user_id = 'anonymous'
    )
  );

-- ─── uploads storage bucket ─────────────────────────────────────────────────
-- Public read stays as-is (AI providers fetch uploaded media by URL — the
-- documented bucket design). Writes and deletes are owner-scoped: the first
-- path segment is the owner identity and must equal the verified JWT `sub`.
-- With no JWT the caller is scoped to the 'anonymous/' prefix; the
-- client-supplied x-user-key header is not consulted, so it cannot be spoofed.
DROP POLICY IF EXISTS "Owners can upload own uploads objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete own uploads objects" ON storage.objects;

CREATE POLICY "Owners can upload own uploads objects"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (
      (storage.foldername(name))[1] = auth.jwt() ->> 'sub'
      OR (
        auth.jwt() ->> 'sub' IS NULL
        AND (storage.foldername(name))[1] = 'anonymous'
      )
    )
  );

CREATE POLICY "Owners can delete own uploads objects"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (
    bucket_id = 'uploads'
    AND (
      (storage.foldername(name))[1] = auth.jwt() ->> 'sub'
      OR (
        auth.jwt() ->> 'sub' IS NULL
        AND (storage.foldername(name))[1] = 'anonymous'
      )
    )
  );
