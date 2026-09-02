-- Template Thumbnail Jobs — completion tracking
BEGIN;

CREATE TABLE IF NOT EXISTS template_thumbnail_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  preset_key text,
  prompt_used text,
  image_url text,
  image_path text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_thumb_jobs_user_template
  ON template_thumbnail_jobs(user_id, template_id);

CREATE INDEX IF NOT EXISTS idx_thumb_jobs_status
  ON template_thumbnail_jobs(status, completed_at DESC);

ALTER TABLE template_thumbnail_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_thumb_job_read" ON template_thumbnail_jobs;
CREATE POLICY "owner_thumb_job_read"
  ON template_thumbnail_jobs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_thumb_job_write" ON template_thumbnail_jobs;
CREATE POLICY "owner_thumb_job_write"
  ON template_thumbnail_jobs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_thumb_job_update" ON template_thumbnail_jobs;
CREATE POLICY "owner_thumb_job_update"
  ON template_thumbnail_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

COMMIT;
