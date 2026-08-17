-- ===========================================================================
-- Personalizer: user scan settings + prompt template seeds
--
-- Two gaps this closes:
--
-- 1. `user_scan_settings` was referenced by
--    netlify/functions/personalizer-api.js (GET/POST /api/personalizer/settings)
--    but never created by any migration. Postgres therefore raised 42P01
--    (undefined_table), which is not the PGRST116 "no rows" code the handler
--    tolerates, so BOTH verbs returned HTTP 500. The client masked this by
--    falling back to localStorage, so scan preferences never persisted
--    server-side and never synced across devices.
--
-- 2. `personalizer_templates` was created empty, so every /generate call
--    silently fell back to the one-line hardcoded default prompts instead of
--    the intended app/mode-specific prompts. Seeds for the modes the app
--    actually uses are added below.
-- ===========================================================================

-- ─── user_scan_settings ────────────────────────────────────────────────────
-- One row per user. The API upserts on user_id, so it is the primary key.
CREATE TABLE IF NOT EXISTS user_scan_settings (
  user_id            UUID PRIMARY KEY,
  -- Number of sites a "fast" Maigret check covers. Clamped 1..2500 by the API.
  default_top        INTEGER NOT NULL DEFAULT 500
                       CHECK (default_top BETWEEN 1 AND 2500),
  -- Per-username scan timeout. Clamped 5000..60000 by the API.
  default_timeout_ms INTEGER NOT NULL DEFAULT 15000
                       CHECK (default_timeout_ms BETWEEN 5000 AND 60000),
  permute_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  disable_recursion  BOOLEAN NOT NULL DEFAULT FALSE,
  check_domains      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Nullable so "unset" is distinguishable from "explicitly empty".
  proxy              TEXT,
  tor_proxy          TEXT DEFAULT 'socks5://127.0.0.1:9050',
  i2p_proxy          TEXT DEFAULT 'http://127.0.0.1:4444',
  -- Modal body theme preference, mirrored to localStorage as a fallback.
  dark_mode          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_scan_settings ENABLE ROW LEVEL SECURITY;

-- Netlify functions use SERVICE_ROLE_KEY and bypass RLS; this policy protects
-- direct client access (anon/authenticated keys).
DROP POLICY IF EXISTS "Users can manage own scan settings" ON user_scan_settings;
CREATE POLICY "Users can manage own scan settings" ON user_scan_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Keep updated_at honest without relying on the caller to send it.
CREATE OR REPLACE FUNCTION set_user_scan_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_scan_settings_updated_at ON user_scan_settings;
CREATE TRIGGER trg_user_scan_settings_updated_at
  BEFORE UPDATE ON user_scan_settings
  FOR EACH ROW EXECUTE FUNCTION set_user_scan_settings_updated_at();

-- ─── personalizer_templates seeds ──────────────────────────────────────────
-- `lead-summary` is the mode PersonalizeModal uses for contact enrichment. It
-- must return strict JSON because the client feeds the result straight into
-- the token/variable map.
INSERT INTO personalizer_templates (app_id, mode, template_type, content) VALUES
(
  'ai-video-agency',
  'lead-summary',
  'system',
  'You are a B2B research analyst. You extract structured, factual business intelligence from OSINT scan data. Never invent facts: if a field is not supported by the provided data, omit it or return an empty array. Respond with JSON only — no markdown, no commentary.'
),
(
  'ai-video-agency',
  'lead-summary',
  'user',
  E'Analyse the OSINT scan data below for {{targetName}}{{#targetCompany}} at {{targetCompany}}{{/targetCompany}}.\n\nCompany hint: {{targetCompany}}\nOperator notes: {{manualNotes}}\n\nScan data:\n{{scanData}}\n\nReturn JSON with this shape:\n{\n  "company":   { "name": string, "domain": string, "industry": string, "size": string, "summary": string },\n  "intelligence": { "summary": string, "products": string[], "services": string[], "painPoints": string[], "interests": string[], "buyingSignals": string[], "tone": "formal"|"casual"|"technical"|"friendly" },\n  "brand": { "colors": { "primary": string, "secondary": string, "accent": string } }\n}\n\nKeep every string under 200 characters. Cap each array at 5 items. Colours must be hex (#rrggbb) or omitted.'
),
(
  'ai-video-agency',
  'video-script',
  'system',
  'You are a direct-response video scriptwriter. You write tight, spoken-word scripts for short personalized sales videos. No stage directions unless asked. No filler.'
),
(
  'ai-video-agency',
  'video-script',
  'user',
  E'Write a {{duration}}-second personalized video script for {{targetName}} at {{targetCompany}}.\n\nOffer: {{offer}}\nGoal: {{goal}}\nCall to action: {{cta}}\nTone: {{tone}}\nVisual style: {{visualStyle}}\nAspect ratio: {{aspectRatio}}\nStory type: {{storyType}}\n\nResearch:\n{{scanData}}\n\nOperator notes: {{manualNotes}}\n\nOpen with a specific, verifiable detail about them — never a generic greeting. End with the call to action.'
)
ON CONFLICT DO NOTHING;
