-- OSM Lead Finder leads table
--
-- Stores business leads discovered through OpenStreetMap data.
-- Each lead represents a local business without a website (or with a bad one),
-- along with contact info, scoring, and pipeline stage.
--
-- NOTE: Named 'osm_leads' to avoid conflict with the existing 'leads' table
-- used by the video remix app's lead generation system.

CREATE TABLE IF NOT EXISTS public.osm_leads (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  niche text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  country_code text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  opening_hours text NOT NULL DEFAULT '',
  lat double precision,
  lon double precision,
  osm_url text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  score integer NOT NULL DEFAULT 0,
  reachability text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'New',
  notes text NOT NULL DEFAULT '',
  starred boolean NOT NULL DEFAULT false,
  owner text NOT NULL DEFAULT '',
  verified_date text NOT NULL DEFAULT '',
  links_ok jsonb NOT NULL DEFAULT '{}'::jsonb,
  whatsapp text NOT NULL DEFAULT '',
  phone_e164 text NOT NULL DEFAULT '',
  activity integer NOT NULL DEFAULT 0,
  segment text NOT NULL DEFAULT '',
  maps_verify text NOT NULL DEFAULT '',
  maps_pin text NOT NULL DEFAULT '',
  maps_street text NOT NULL DEFAULT '',
  search_niche text NOT NULL DEFAULT '',
  search_city text NOT NULL DEFAULT '',
  search_country text NOT NULL DEFAULT '',
  user_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_osm_leads_stage ON public.osm_leads(stage);
CREATE INDEX IF NOT EXISTS idx_osm_leads_niche ON public.osm_leads(niche);
CREATE INDEX IF NOT EXISTS idx_osm_leads_city ON public.osm_leads(city);
CREATE INDEX IF NOT EXISTS idx_osm_leads_country ON public.osm_leads(country);
CREATE INDEX IF NOT EXISTS idx_osm_leads_score ON public.osm_leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_osm_leads_starred ON public.osm_leads(starred) WHERE starred = true;
CREATE INDEX IF NOT EXISTS idx_osm_leads_user_id ON public.osm_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_osm_leads_created_at ON public.osm_leads(created_at DESC);

ALTER TABLE public.osm_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view their own leads"
  ON public.osm_leads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text OR user_id IS NULL);

CREATE POLICY "Authenticated users can insert leads"
  ON public.osm_leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update their own leads"
  ON public.osm_leads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text OR user_id IS NULL);

CREATE POLICY "Authenticated users can delete their own leads"
  ON public.osm_leads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid()::text OR user_id IS NULL);

-- Integration table linking leads to created sites
CREATE TABLE IF NOT EXISTS public.site_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id text REFERENCES public.osm_leads(id) ON DELETE CASCADE,
  site_id text UNIQUE,
  status text DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','failed')),
  preview_url text,
  brief_text text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_site_leads_lead_id ON public.site_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_site_leads_status ON public.site_leads(status);

ALTER TABLE public.site_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their site_leads" ON public.site_leads FOR ALL TO authenticated USING (true);
