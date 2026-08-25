-- Template Thumbnail Extensions (defensive v2)
-- Fully guarded against any existing thumbnails schema.

BEGIN;

-- 1) Extend thumbnails table (idempotent)
ALTER TABLE thumbnails
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;

-- 2) Drop the legacy simple UNIQUE constraint if it exists.
ALTER TABLE thumbnails DROP CONSTRAINT IF EXISTS thumbnails_target_type_target_id_key;

-- Helper: a single column-exists check used below
-- 3) Partial unique: admin row per (target_type, target_id) WHERE is_custom=false
--    Guard against missing target_type, target_id, is_custom
DO $body$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'thumbnails'
      AND column_name = 'target_type'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'thumbnails'
      AND column_name = 'target_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'thumbnails'
      AND column_name = 'is_custom'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_thumbnails_admin_unique
      ON thumbnails(target_type, target_id) WHERE is_custom = false';
  END IF;
END
$body$;

-- 4) Partial unique: custom row per (user_id, target_id) WHERE target_type='template' AND is_custom=true
DO $body$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'thumbnails'
      AND column_name = 'user_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'thumbnails'
      AND column_name = 'target_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'thumbnails'
      AND column_name = 'target_type'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'thumbnails'
      AND column_name = 'is_custom'
  ) THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_thumbnails_user_template_custom
      ON thumbnails(user_id, target_id)
      WHERE target_type = ''template'' AND is_custom = true';
  END IF;
END
$body$;

-- 5-7) RLS policies — only create if the referenced columns exist
DO $body$
BEGIN
  -- 5) Read access for authenticated users — no column dependencies
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'thumbnails') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read thumbnails" ON thumbnails';
    EXECUTE 'CREATE POLICY "Authenticated users can read thumbnails"
      ON thumbnails FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)';
  END IF;

  -- 6) Owner-only INSERT — needs target_type, is_custom, user_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='thumbnails' AND column_name='target_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='thumbnails' AND column_name='is_custom')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='thumbnails' AND column_name='user_id')
  THEN
    EXECUTE 'DROP POLICY IF EXISTS "owner_thumbnail_write" ON thumbnails';
    EXECUTE 'CREATE POLICY "owner_thumbnail_write"
      ON thumbnails FOR INSERT TO authenticated
      WITH CHECK (target_type = ''template'' AND is_custom = true AND auth.uid() = user_id)';
  END IF;

  -- 7) Owner-only UPDATE — same column dependencies as 6
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='thumbnails' AND column_name='target_type')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='thumbnails' AND column_name='is_custom')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='thumbnails' AND column_name='user_id')
  THEN
    EXECUTE 'DROP POLICY IF EXISTS "owner_thumbnail_update" ON thumbnails';
    EXECUTE 'CREATE POLICY "owner_thumbnail_update"
      ON thumbnails FOR UPDATE TO authenticated
      USING (target_type = ''template'' AND is_custom = true AND auth.uid() = user_id)';
  END IF;
END
$body$;

-- 8) Storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('template-thumbnails', 'template-thumbnails', true)
  ON CONFLICT (id) DO NOTHING;

-- 9-11) Storage RLS policies (no column dependencies on the storage side)
DO $body$
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "thumbnail_read" ON storage.objects';
  EXECUTE 'CREATE POLICY "thumbnail_read"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = ''template-thumbnails'')';

  EXECUTE 'DROP POLICY IF EXISTS "thumbnail_owner_insert" ON storage.objects';
  EXECUTE 'CREATE POLICY "thumbnail_owner_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = ''template-thumbnails'')';

  EXECUTE 'DROP POLICY IF EXISTS "thumbnail_owner_delete" ON storage.objects';
  EXECUTE 'CREATE POLICY "thumbnail_owner_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = ''template-thumbnails'')';
END
$body$;

COMMIT;
