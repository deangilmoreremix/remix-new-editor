-- Template Thumbnail Extensions
-- Adds user-generated thumbnail support: storage bucket, schema extensions, RLS

BEGIN;

-- 1) Extend thumbnails table
ALTER TABLE thumbnails
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS is_custom boolean DEFAULT false;

-- 2) Drop existing simple UNIQUE(target_type, target_id) constraint.
--    It prevents multiple rows per template across users and must be replaced
--    with partial indexes for admin rows and custom user rows.
ALTER TABLE thumbnails DROP CONSTRAINT IF EXISTS thumbnails_target_type_target_id_key;

-- 3) Partial unique: one admin row per (target_type, target_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_thumbnails_admin_unique
  ON thumbnails(target_type, target_id)
  WHERE is_custom = false;

-- 4) Partial unique: one custom row per (user_id, target_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_thumbnails_user_template_custom
  ON thumbnails(user_id, target_id)
  WHERE target_type = 'template' AND is_custom = true;

-- 5) RLS: read access remains for all authenticated users
DROP POLICY IF EXISTS "Authenticated users can read thumbnails" ON thumbnails;
CREATE POLICY "Authenticated users can read thumbnails"
  ON thumbnails FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 6) RLS: owner-only INSERT for custom thumbnails
DROP POLICY IF EXISTS "owner_thumbnail_write" ON thumbnails;
CREATE POLICY "owner_thumbnail_write"
  ON thumbnails FOR INSERT TO authenticated
  WITH CHECK (
    target_type = 'template'
    AND is_custom = true
    AND auth.uid() = user_id
  );

-- 7) RLS: owner-only UPDATE for custom thumbnails
DROP POLICY IF EXISTS "owner_thumbnail_update" ON thumbnails;
CREATE POLICY "owner_thumbnail_update"
  ON thumbnails FOR UPDATE TO authenticated
  USING (
    target_type = 'template'
    AND is_custom = true
    AND auth.uid() = user_id
  );

-- 8) Storage bucket for user-generated thumbnails
INSERT INTO storage.buckets (id, name, public)
  VALUES ('template-thumbnails', 'template-thumbnails', true)
  ON CONFLICT (id) DO NOTHING;

-- 9) Storage RLS: authenticated users can read
CREATE POLICY IF NOT EXISTS "thumbnail_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'template-thumbnails');

-- 10) Storage RLS: authenticated users can insert
CREATE POLICY IF NOT EXISTS "thumbnail_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'template-thumbnails');

-- 11) Storage RLS: authenticated users can delete
CREATE POLICY IF NOT EXISTS "thumbnail_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'template-thumbnails');

COMMIT;
