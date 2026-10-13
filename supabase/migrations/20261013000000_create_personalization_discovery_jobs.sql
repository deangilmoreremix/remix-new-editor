-- Personalization discovery jobs
--
-- Durable job records for the website asset-discovery pipeline exposed by
-- netlify/functions/personalization-discovery.js.
--
-- The discovery engine's job store is in-process (per its spec): a Netlify
-- function invocation has no shared filesystem and no long-lived state, so
-- this table is the durable fallback layer. The function writes a row when
-- a job starts and mirrors the terminal state into it (completed → 'done')
-- while its instance stays warm, so:
--   - results survive the engine's 60s job GC and instance rotation;
--   - a GET whose job is still non-terminal but whose engine record is gone
--     (cold instance) is reported as 'unknown' and the client re-submits.
--
-- Access model: SERVICE ROLE ONLY. The function reads and writes with the
-- service-role key (SUPABASE_SERVICE_ROLE_KEY) only after verifying the
-- caller. RLS is enabled and NO policies are granted to anon/authenticated,
-- so the table is unreachable from the browser — there is deliberately no
-- client-side read or write path for it.

create table if not exists public.personalization_discovery_jobs (
  id text primary key default gen_random_uuid()::text,
  user_id text,                          -- null for internal shared-secret callers
  url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed', 'cancelled', 'unknown')),
  found jsonb,                           -- { urls, logos, products, brandReferences }
  errors text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Hot path: a caller's recent jobs.
create index if not exists personalization_discovery_jobs_user_idx
  on public.personalization_discovery_jobs (user_id, created_at desc);

-- Hot path: finding still-running jobs (partial index keeps it small).
create index if not exists personalization_discovery_jobs_active_idx
  on public.personalization_discovery_jobs (updated_at)
  where status in ('pending', 'running');

alter table public.personalization_discovery_jobs enable row level security;

-- Intentionally no RLS policies: service-role access only (see header).
