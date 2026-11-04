-- ===========================================================================
-- create_video_leads.sql
--
-- Leads captured by the timeline's interactive addons (Lead Generator clip,
-- project-level List Builder / Personalizer). Upstream (strategic-limited/
-- remix-new-editor) stored these on an external backend as
-- `video_opted_in` events; this table replaces that.
--
-- Rows are written by the `lead-capture` edge function using the CALLER's
-- Clerk session JWT (no service role), so RLS below is the only gate:
-- a row's owner is the verified `sub` claim of whoever is signed in.
-- Owners can read and delete their own leads; nobody can update them.
--
-- Same identity model as 20261013120000_harden_personalization_rls.sql
-- (Clerk as a Supabase third-party auth provider). Without that external
-- configuration the policies fail closed and nothing is stored; the edge
-- function still forwards webhooks.
-- ===========================================================================

create table if not exists public.video_leads (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default ((select auth.jwt() ->> 'sub')),
  project_id text,
  clip_id text,
  kind text not null default 'lead-form'
    check (kind in ('lead-form', 'list-builder', 'personalizer')),
  data jsonb not null default '{}'::jsonb,
  source jsonb not null default '{}'::jsonb,
  preview boolean not null default true,
  created_at timestamptz not null default now(),
  constraint video_leads_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint video_leads_data_size check (pg_column_size(data) < 32768)
);

create index if not exists video_leads_owner_project_idx
  on public.video_leads (clerk_user_id, project_id, created_at desc);
create index if not exists video_leads_owner_clip_idx
  on public.video_leads (clerk_user_id, clip_id);

alter table public.video_leads enable row level security;

drop policy if exists "Clerk-verified users select own video leads" on public.video_leads;
drop policy if exists "Clerk-verified users insert own video leads" on public.video_leads;
drop policy if exists "Clerk-verified users delete own video leads" on public.video_leads;

create policy "Clerk-verified users select own video leads"
  on public.video_leads
  for select
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Clerk-verified users insert own video leads"
  on public.video_leads
  for insert
  to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Clerk-verified users delete own video leads"
  on public.video_leads
  for delete
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

grant select, insert, delete on public.video_leads to anon, authenticated;
