-- Intelligence & Personalization Platform tables
-- Supports /api/intelligence and /api/personalizer Netlify functions.

-- ─── contacts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  title TEXT,
  location TEXT,
  source TEXT DEFAULT 'manual',
  source_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_updated_at ON contacts(user_id, updated_at DESC);

-- ─── contact_profiles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_profiles (
  contact_id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  profile JSONB DEFAULT '{}'::jsonb,
  discovery_status TEXT DEFAULT 'pending',
  last_discovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── contact_variables ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_variables (
  contact_id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
  variables JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── contact_assets ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  url TEXT,
  storage_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_assets_contact_id ON contact_assets(contact_id, created_at DESC);

-- ─── contact_discoveries ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_discoveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  data JSONB,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contact_discoveries_contact_id ON contact_discoveries(contact_id, created_at DESC);

-- ─── profile_scan_results ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_name TEXT NOT NULL,
  scan_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_scan_results_user_id ON profile_scan_results(user_id, created_at DESC);

-- ─── personalizer_apps ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personalizer_apps (
  app_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default apps
INSERT INTO personalizer_apps (app_id, name, description) VALUES
  ('ai-video-agency', 'AI Video Agency', 'Personalized video outreach'),
  ('ai-cinema-template', 'AI Cinema Template', 'Cinematic personalized videos'),
  ('ai-headshot-studio', 'AI Headshot Studio', 'Personalized headshot generation')
ON CONFLICT (app_id) DO NOTHING;

-- ─── personalizer_templates ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personalizer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT REFERENCES personalizer_apps(app_id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('system', 'user')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personalizer_templates_app_mode ON personalizer_templates(app_id, mode);

-- ─── personalization_projects ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personalization_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  app_id TEXT NOT NULL DEFAULT 'ai-video-agency',
  scan_id UUID REFERENCES profile_scan_results(id) ON DELETE SET NULL,
  mode TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_company TEXT,
  manual_notes TEXT,
  visual_style TEXT,
  aspect_ratio TEXT,
  duration_seconds INTEGER,
  status TEXT DEFAULT 'generating',
  handoff_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personalization_projects_user_id ON personalization_projects(user_id, created_at DESC);

-- ─── personalization_outputs ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personalization_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES personalization_projects(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personalization_outputs_project_id ON personalization_outputs(project_id, created_at DESC);

-- ─── personalized_assets ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS personalized_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES personalization_projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  generation_prompt TEXT,
  storage_path TEXT,
  url TEXT,
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personalized_assets_project_id ON personalized_assets(project_id, created_at DESC);

-- ─── Row Level Security ─────────────────────────────────────────────────
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalization_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalization_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalized_assets ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (Netlify functions use SERVICE_ROLE_KEY).
-- Authenticated users can only access their own data.
CREATE POLICY "Users can manage own contacts" ON contacts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own scan results" ON profile_scan_results
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own projects" ON personalization_projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Personalize tables that join via contacts/projects use a subquery policy
CREATE POLICY "Users can view own contact profiles" ON contact_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_profiles.contact_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Users can view own contact variables" ON contact_variables
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_variables.contact_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Users can view own contact assets" ON contact_assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_assets.contact_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Users can view own contact discoveries" ON contact_discoveries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_discoveries.contact_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Users can view own outputs" ON personalization_outputs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM personalization_projects p WHERE p.id = personalization_outputs.project_id AND p.user_id = auth.uid())
  );
CREATE POLICY "Users can view own assets" ON personalized_assets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM personalization_projects p WHERE p.id = personalized_assets.project_id AND p.user_id = auth.uid())
  );

-- Public read access for app and template registries
ALTER TABLE personalizer_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalizer_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read personalizer_apps" ON personalizer_apps FOR SELECT USING (true);
CREATE POLICY "Public read personalizer_templates" ON personalizer_templates FOR SELECT USING (true);
