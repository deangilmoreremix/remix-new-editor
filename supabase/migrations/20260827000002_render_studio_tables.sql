-- Render studio persistence tables
-- Drafts, templates, and render queue saved to Supabase for cross-device access

CREATE TABLE IF NOT EXISTS public.render_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Untitled Draft',
  video_url text,
  video_id text,
  prompt text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.render_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Untitled Template',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  video_url text,
  video_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.render_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  video_id text,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  result_url text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_render_drafts_user_id ON public.render_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_render_drafts_updated_at ON public.render_drafts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_templates_user_id ON public.render_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_render_templates_updated_at ON public.render_templates(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_render_queue_user_id ON public.render_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_render_queue_status ON public.render_queue(status);

-- Row Level Security
ALTER TABLE public.render_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_queue ENABLE ROW LEVEL SECURITY;

-- Policies: users can only access their own data
CREATE POLICY "Users can manage their own render drafts"
  ON public.render_drafts FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their own render templates"
  ON public.render_templates FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage their own render queue"
  ON public.render_queue FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
