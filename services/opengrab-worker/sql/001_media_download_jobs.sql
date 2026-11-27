-- REVIEW ONLY: not applied. Shared Supabase project; one table for both apps.
-- Owner key is (app_id, user_id) as text: remix-new-editor uses Supabase user ids, OpenHiggsBolt uses Clerk ids.
-- RLS is on with no policies, so anon/authenticated clients can do nothing; only the worker's service-role key can.
create table if not exists public.media_download_jobs (
  id uuid primary key default gen_random_uuid(),
  app_id text not null check (app_id ~ '^[a-z0-9_-]{1,32}$'),
  user_id text not null check (char_length(user_id) between 1 and 128),
  upstream_job_id text,
  batch_id uuid,
  source_url text not null,
  canonical_url text,
  source_platform text,
  source_media_id text,
  title text,
  kind text not null check (kind in ('video','audio','clip','subtitles','thumbnail')),
  options jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued','downloading','processing','uploading','done','failed','cancelled')),
  stage text,
  percent real default 0,
  speed text,
  eta text,
  downloaded_bytes bigint,
  total_bytes bigint,
  error text,
  storage_path text,
  size_bytes bigint,
  duration_s real,
  width int,
  height int,
  vcodec text,
  acodec text,
  import_status text default 'none',
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  expires_at timestamptz
);
create index if not exists media_download_jobs_owner_idx on public.media_download_jobs (app_id, user_id, created_at desc);
create index if not exists media_download_jobs_active_idx on public.media_download_jobs (status)
  where status in ('queued','downloading','processing','uploading');
create index if not exists media_download_jobs_media_idx on public.media_download_jobs (app_id, user_id, source_media_id);
alter table public.media_download_jobs enable row level security;
