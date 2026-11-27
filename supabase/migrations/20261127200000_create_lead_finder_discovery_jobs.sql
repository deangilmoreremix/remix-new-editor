-- Personalization website-discovery jobs.
--
-- netlify/functions/_personalization/src/server/discoveryJobs.ts reads/writes
-- public.lead_finder_discovery_jobs, but production only has the older
-- public.personalization_discovery_jobs, so every "look up a business"
-- request failed with "Failed to create discovery job".
-- 20261102000000_lead_finder_personalization.sql defines this table but was
-- never applied in full; this migration is the idempotent subset for it.

create table if not exists public.lead_finder_discovery_jobs (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  website_url text not null,
  status text not null default 'queued',
  fast_result_json jsonb,
  browser_result_json jsonb,
  final_result_json jsonb,
  telemetry_json jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days'
);

create index if not exists idx_lead_finder_discovery_jobs_user
  on public.lead_finder_discovery_jobs (clerk_user_id, created_at desc);

create index if not exists idx_lead_finder_discovery_jobs_status
  on public.lead_finder_discovery_jobs (status, created_at);

alter table public.lead_finder_discovery_jobs enable row level security;

drop policy if exists "Users can view own discovery jobs" on public.lead_finder_discovery_jobs;
drop policy if exists "Users can insert own discovery jobs" on public.lead_finder_discovery_jobs;
drop policy if exists "Users can update own discovery jobs" on public.lead_finder_discovery_jobs;

create policy "Users can view own discovery jobs"
  on public.lead_finder_discovery_jobs
  for select
  using (clerk_user_id = coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)));

create policy "Users can insert own discovery jobs"
  on public.lead_finder_discovery_jobs
  for insert
  with check (clerk_user_id = coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)));

create policy "Users can update own discovery jobs"
  on public.lead_finder_discovery_jobs
  for update
  using (clerk_user_id = coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)))
  with check (clerk_user_id = coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)));
