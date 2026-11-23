-- Finder continuity (E8): saved searches, "looks wrong" feedback, public enrichment cache.
-- APPLIED to the project via the Supabase tool as migration `finder_continuity_tables` (2026-11-15),
-- approved by the owner as drafted in PR #184. Recorded here so the repo matches the database.
--
-- Same ownership model as personalization_saved_projects / lead_finder_leads: Clerk user id as text,
-- RLS keyed on the app.clerk_user_id GUC (fail-closed for direct browser access).
--
-- Rollback (drops data): drop table public.business_enrichment_cache, public.finder_lead_feedback, public.finder_saved_searches;

create table if not exists public.finder_saved_searches (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text not null,
  name           text not null check (char_length(name) between 1 and 80),
  niche          text not null,
  location       text not null check (char_length(location) between 1 and 120),
  radius_miles   integer not null default 15 check (radius_miles between 1 and 50),
  include_chains boolean not null default false,
  -- Alerts are opt-in per search and default OFF. Nothing sends until a separate, approved scheduled job exists.
  alert_enabled  boolean not null default false,
  last_run_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint finder_saved_searches_owner_name_key unique (clerk_user_id, name)
);
comment on table public.finder_saved_searches is
  'Business Finder saved searches, owned by a Clerk user id. Max rows per user is enforced by the server route (proposed: 25).';
create index if not exists finder_saved_searches_owner_idx
  on public.finder_saved_searches (clerk_user_id, updated_at desc);

alter table public.finder_saved_searches enable row level security;
drop policy if exists "finder_saved_searches_select_own" on public.finder_saved_searches;
create policy "finder_saved_searches_select_own" on public.finder_saved_searches for select
  using (clerk_user_id = nullif(current_setting('app.clerk_user_id', true), ''));
drop policy if exists "finder_saved_searches_insert_own" on public.finder_saved_searches;
create policy "finder_saved_searches_insert_own" on public.finder_saved_searches for insert
  with check (clerk_user_id = nullif(current_setting('app.clerk_user_id', true), ''));
drop policy if exists "finder_saved_searches_update_own" on public.finder_saved_searches;
create policy "finder_saved_searches_update_own" on public.finder_saved_searches for update
  using (clerk_user_id = nullif(current_setting('app.clerk_user_id', true), ''))
  with check (clerk_user_id = nullif(current_setting('app.clerk_user_id', true), ''));
drop policy if exists "finder_saved_searches_delete_own" on public.finder_saved_searches;
create policy "finder_saved_searches_delete_own" on public.finder_saved_searches for delete
  using (clerk_user_id = nullif(current_setting('app.clerk_user_id', true), ''));

-- ---------------------------------------------------------------------------
-- 2. "Looks wrong" feedback (per user; never edits the shared chain registry)
-- ---------------------------------------------------------------------------
create table if not exists public.finder_lead_feedback (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text not null,
  business_id    text not null,
  reason         text not null,
  note           text check (note is null or char_length(note) <= 280),
  created_at     timestamptz not null default now(),
  constraint finder_lead_feedback_reason_check
    check (reason in ('is_a_chain', 'wrong_category', 'closed', 'wrong_contact', 'not_local', 'other')),
  constraint finder_lead_feedback_owner_business_reason_key unique (clerk_user_id, business_id, reason)
);
comment on table public.finder_lead_feedback is
  'A user''s own "looks wrong" flags. Used to hide/annotate for that user and, aggregated, to SUGGEST chain-registry additions to the owner. Never auto-edits the registry.';
create index if not exists finder_lead_feedback_owner_idx
  on public.finder_lead_feedback (clerk_user_id, created_at desc);
create index if not exists finder_lead_feedback_business_idx
  on public.finder_lead_feedback (business_id, reason);

alter table public.finder_lead_feedback enable row level security;
drop policy if exists "finder_lead_feedback_select_own" on public.finder_lead_feedback;
create policy "finder_lead_feedback_select_own" on public.finder_lead_feedback for select
  using (clerk_user_id = nullif(current_setting('app.clerk_user_id', true), ''));
drop policy if exists "finder_lead_feedback_insert_own" on public.finder_lead_feedback;
create policy "finder_lead_feedback_insert_own" on public.finder_lead_feedback for insert
  with check (clerk_user_id = nullif(current_setting('app.clerk_user_id', true), ''));
drop policy if exists "finder_lead_feedback_delete_own" on public.finder_lead_feedback;
create policy "finder_lead_feedback_delete_own" on public.finder_lead_feedback for delete
  using (clerk_user_id = nullif(current_setting('app.clerk_user_id', true), ''));

-- ---------------------------------------------------------------------------
-- 3. Durable enrichment cache — PUBLIC website data only
-- ---------------------------------------------------------------------------
-- Keyed by normalised website host. Holds only what the business's own public pages published
-- (the same BusinessEnrichment JSON the in-memory cache holds today): no user ids, no notes.
-- RLS is enabled with NO policies, so anon/authenticated roles see nothing; only the server's
-- service role reads/writes it.
create table if not exists public.business_enrichment_cache (
  host        text primary key check (char_length(host) between 3 and 253),
  enrichment  jsonb not null,
  fetched_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
comment on table public.business_enrichment_cache is
  'Public website enrichment, TTL-bound (proposed: 7 days). Server role only. Contains no per-user data.';
create index if not exists business_enrichment_cache_expires_idx
  on public.business_enrichment_cache (expires_at);
alter table public.business_enrichment_cache enable row level security;
revoke all on public.business_enrichment_cache from anon, authenticated;
