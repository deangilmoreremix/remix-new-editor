-- Personalization outputs table
--
-- Persists personalization generation results per user so history survives
-- server restarts and multi-instance deployments.
--
-- ── Auth model differences vs. OpenHiggsBolt ────────────────────────────────
-- The OpenHiggsBolt source migration
--   (OpenHiggsBolt/supabase/migrations/20260905000000_create_personalization_outputs.sql)
-- uses Clerk as the identity provider and sets the per-request user id
-- via `supabase.rpc('set_config', { setting: 'app.clerk_user_id', ... })`
-- so the RLS policy can read
--   `clerk_user_id = current_setting('app.clerk_user_id', true)`.
--
-- The remix-new-editor uses Supabase Auth (not Clerk). The
-- per-request authenticated user id is exposed by Supabase as
-- `auth.uid()` (a UUID), which is NOT directly comparable to the
-- `clerk_user_id text` column the OpenHiggsBolt schema stores.
--
-- To keep the column shape and indexes identical (for cross-app
-- compatibility) while switching the RLS gate to Supabase Auth,
-- this migration:
--   1. Keeps `clerk_user_id text not null` and the existing indexes.
--   2. Defines a `public.current_user_id()` function that returns
--      `auth.uid()::text` (the JWT sub claim of the calling user).
--   3. Rewrites the RLS policies to use `current_user_id()` instead
--      of `current_setting('app.clerk_user_id', true)`.
-- Callers that write to this table must populate `clerk_user_id`
-- with the same value returned by `auth.uid()::text` (i.e. the
-- authenticated user's UUID). The UI store layer
-- (sharedMediaStore + future supabaseSharedMedia helper) is
-- expected to read it from the session.

create table if not exists public.personalization_outputs (
  id text primary key default gen_random_uuid()::text,
  clerk_user_id text not null,
  origin_studio text not null default 'demo-personalization',
  source_type text not null,
  source_demo_id text,
  source_demo_slug text,
  viral_record_id text,
  source_media text,
  source_url text,
  personalization_mode text,
  model text,
  original_prompt text not null,
  personalized_prompt text not null,
  identity_asset_ids text[] not null default '{}',
  logo_asset_ids text[] not null default '{}',
  product_asset_ids text[] not null default '{}',
  brand_reference_asset_ids text[] not null default '{}',
  first_frame_asset_id text,
  last_frame_asset_id text,
  output_urls text[] not null default '{}',
  output_type text not null,
  client_id text,
  created_at timestamptz not null default now()
);

create index if not exists personalization_outputs_clerk_user_id_idx
  on public.personalization_outputs(clerk_user_id);

create index if not exists personalization_outputs_created_at_idx
  on public.personalization_outputs(created_at desc);

-- Helper: returns the calling Supabase Auth user id as text. Mirrors
-- the `current_setting('app.clerk_user_id', true)` pattern used by
-- the OpenHiggsBolt schema but reads from `auth.uid()` instead.
create or replace function public.current_user_id()
returns text
language sql
stable
as $$
  select auth.uid()::text;
$$;

alter table public.personalization_outputs enable row level security;

drop policy if exists "Users can view own personalization outputs" on public.personalization_outputs;
drop policy if exists "Users can insert own personalization outputs" on public.personalization_outputs;

create policy "Users can view own personalization outputs"
  on public.personalization_outputs for select
  using (clerk_user_id = public.current_user_id());

create policy "Users can insert own personalization outputs"
  on public.personalization_outputs for insert
  with check (clerk_user_id = public.current_user_id());
