-- Generated video history (e.g. Full Body Recast results).
--
-- The client already posts these records to /api/video/record
-- (src/shared/personalization/supabaseGeneratedVideos.ts), but no route or
-- table existed, so every record was a 404 that was silently ignored. This
-- adds the table that route writes to. Columns mirror GeneratedVideoEntry.
--
-- Ownership uses the Clerk identity (clerk_user_id text), like every other
-- personalization table here. Only the server (service role) reads or writes
-- this table, so RLS is enabled with no policies: anon/authenticated keys get
-- nothing.

create table if not exists public.generated_videos (
  id                   uuid primary key default gen_random_uuid(),
  clerk_user_id        text not null,
  project_id           text,
  client_id            text,
  source_type          text,
  source_media         text,
  source_url           text,
  personalization_mode text,
  model                text not null,
  prompt               text not null default '',
  selected_asset_ids   text[] not null default '{}',
  provider_job_id      text,
  video_url            text not null,
  storage_path         text,
  status               text not null default 'completed',
  duration_seconds     numeric,
  aspect_ratio         text,
  resolution           text,
  quality              text,
  effect               text,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now()
);

create index if not exists generated_videos_user_created_idx
  on public.generated_videos (clerk_user_id, created_at desc);

alter table public.generated_videos enable row level security;
