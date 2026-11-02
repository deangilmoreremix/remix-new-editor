-- Personalization + Lead Finder (ported from OpenHiggsBolt)
--
-- Tables and RPCs behind netlify/functions/personalization-api.mts:
--   * lead_finder_leads (+ list/upsert/delete RPCs)       — Saved Leads
--   * personalization_saved_projects (+ RPCs)             — resumable projects
--   * smartvideo_go_personalization_outputs               — generated outputs
--   * lead_finder_discovery_jobs                          — website asset discovery jobs
--   * personalization_demo_discovery_limits / _cache      — anonymous discovery
--
-- This is the OpenHiggsBolt migration set concatenated in its original order.
-- Two adaptations for remix:
--   1. OpenHiggsBolt's `lead_finder_discovery_jobs` is renamed
--      `lead_finder_discovery_jobs`, because remix already has a different
--      `lead_finder_discovery_jobs` table (Personalization Hub).
--   2. Row ownership checks also accept remix's Clerk-minted Supabase JWT
--      (`auth.jwt() ->> 'sub'`, see netlify/functions/supabase-token.js).
-- The Netlify function talks to these through the service role and passes
-- the verified Clerk user id, exactly as the OpenHiggsBolt routes do.

-- ════════════════════════════════════════════════════════════════════
-- from OpenHiggsBolt: 20260919000000_create_smartvideo_go_personalization_outputs.sql
-- ════════════════════════════════════════════════════════════════════
-- SmartVideo GO Personalization Outputs
--
-- Dedicated persistence table for OpenHiggs personalization outputs.
-- This table does NOT replace or extend the existing `personalization_outputs`
-- table used by another application.

create table if not exists public.smartvideo_go_personalization_outputs (
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

create index if not exists smartvideo_go_personalization_outputs_clerk_user_id_idx
  on public.smartvideo_go_personalization_outputs(clerk_user_id);

create index if not exists smartvideo_go_personalization_outputs_created_at_idx
  on public.smartvideo_go_personalization_outputs(created_at desc);

alter table public.smartvideo_go_personalization_outputs enable row level security;

create policy "Users can view own smartvideo go personalization outputs"
  on public.smartvideo_go_personalization_outputs for select
  using (clerk_user_id = coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)));

create policy "Users can insert own smartvideo go personalization outputs"
  on public.smartvideo_go_personalization_outputs for insert
  with check (clerk_user_id = coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)));

-- ════════════════════════════════════════════════════════════════════
-- from OpenHiggsBolt: 20260928000000_create_lead_finder_discovery_jobs.sql
-- ════════════════════════════════════════════════════════════════════
-- Personalization discovery background jobs
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

create policy "Users can view own discovery jobs"
  on public.lead_finder_discovery_jobs
  for select
  using (clerk_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can insert own discovery jobs"
  on public.lead_finder_discovery_jobs
  for insert
  with check (clerk_user_id = (auth.jwt() ->> 'sub'));

create policy "Users can update own discovery jobs"
  on public.lead_finder_discovery_jobs
  for update
  using (clerk_user_id = (auth.jwt() ->> 'sub'));

-- ════════════════════════════════════════════════════════════════════
-- from OpenHiggsBolt: 20261010160000_fix_discovery_jobs_rls_clerk.sql
-- ════════════════════════════════════════════════════════════════════
-- H5 (High): lead_finder_discovery_jobs RLS policies are inert under Clerk auth.
--
-- The original migration (20260928000000_create_lead_finder_discovery_jobs.sql)
-- scoped all three policies to `clerk_user_id = (auth.jwt() ->> 'sub')`. This project
-- authenticates with Clerk, NOT Supabase Auth:
--   * The browser anon key (src/lib/supabase.ts, NEXT_PUBLIC_SUPABASE_ANON_KEY)
--     never carries a Supabase JWT, so `auth.uid()` is always NULL.
--   * `clerk_user_id = NULL` is never true, so the three policies below matched
--     ZERO rows. The table behaved as if it had no owner-scoped policies at all.
--
-- Applied migrations are immutable and this repo forbids editing them, so this
-- new migration DROPS the three broken policies and recreates them with the
-- correct Clerk idiom, copied verbatim from the reference migration
-- 20260905000000_create_personalization_outputs.sql:
--
--   clerk_user_id = coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true))
--
-- The request user is established by calling
--   set_config('app.clerk_user_id', <clerk user id>, true)
-- on the session — see src/lib/supabaseServer.ts:19-39 and the
-- `set_config` RPC calls in app/api/personalization/project/route.ts:69-73.
-- The `true` second argument makes a missing setting return NULL (fail closed),
-- so unauthenticated anon clients match no rows instead of erroring.
--
-- Re-runnable: every statement below is idempotent (enable is a no-op when the
-- table already has RLS; each policy is dropped with `if exists` first).

alter table public.lead_finder_discovery_jobs enable row level security;

drop policy if exists "Users can view own discovery jobs"
  on public.lead_finder_discovery_jobs;

drop policy if exists "Users can insert own discovery jobs"
  on public.lead_finder_discovery_jobs;

drop policy if exists "Users can update own discovery jobs"
  on public.lead_finder_discovery_jobs;

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

-- ════════════════════════════════════════════════════════════════════
-- from OpenHiggsBolt: 20261013000000_personalization_saved_projects.sql
-- ════════════════════════════════════════════════════════════════════
-- Personalization saved projects: dedicated table + atomic ownership RPCs.
--
-- H6 follow-up: the existing public.personalization_projects table is owned by
-- a different feature (profile-scan driven generation). Verified live before
-- writing this migration:
--   * user_id uuid NOT NULL  FOREIGN KEY auth.users(id)   -- the Supabase auth
--     table, unused by this app (Clerk is the identity provider), so a Clerk
--     user id can never satisfy it;
--   * mode / status carry CHECK constraints
--     (mode IN ('cold-email','video-email','proposal','sales-page','thumbnail',
--      'content-campaign','agency-pitch','lead-summary'),
--      status IN ('draft','generating','complete','failed')) that the
--     personalization route's values do not satisfy;
--   * scan_id uuid FOREIGN KEY profile_scan_results(id);
--   * 0 rows, RLS disabled, one inert `auth.uid() = user_id` policy.
-- app/api/personalization/project/route.ts selects clerk_user_id, source,
-- client, assets, prompt, output_type, generation and error_message -- none of
-- which exist there -- so it fails with PostgREST 42703 today.
--
-- Rather than relaxing another feature's NOT NULL columns, foreign keys and
-- CHECK constraints (which would silently widen that feature's accepted
-- input), the personalization feature gets its own table. The existing
-- personalization_projects table, its constraints, its rows and its policy are
-- left byte-for-byte untouched, and 20261010160100_personalization_projects_owner_rls.sql
-- stays a documented no-op for it.
--
-- The ownership model uses the Clerk identity (clerk_user_id text), matching
-- every other personalization table in this repo.
--
-- OWNERSHIP IS ENFORCED IN THE DATABASE, ATOMICALLY. The route previously ran
--   await supabase.rpc('set_config', {setting:'app.clerk_user_id', is_local:true})
--   await supabase.from(...).select(...)
-- as two separate HTTP round-trips. PostgREST serves each request from a
-- connection pool, so `set_config(..., is_local => true)` is scoped to the
-- *first* request's transaction and is discarded before the second one runs;
-- the GUC the RLS policies read is therefore empty and the policies match
-- nothing. The functions below accept the identity as an explicit parameter and
-- call set_config inside the SAME transaction as the protected operation, so
-- the ownership check is both atomic and correct.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.personalization_saved_projects (
  id             uuid primary key default gen_random_uuid(),
  clerk_user_id  text not null,
  source         jsonb not null default '{}'::jsonb,
  client         jsonb not null default '{}'::jsonb,
  assets         jsonb not null default '{}'::jsonb,
  prompt         jsonb not null default '{}'::jsonb,
  generation     jsonb not null default '{}'::jsonb,
  output_type    text not null default 'prompt',
  mode           text,
  status         text not null default 'idle',
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint personalization_saved_projects_status_check
    check (status in ('idle', 'generating', 'complete', 'failed', 'error'))
);

comment on table public.personalization_saved_projects is
  'Saved personalization projects, owned by a Clerk user id. See app/api/personalization/project/route.ts.';

create index if not exists personalization_saved_projects_clerk_user_id_idx
  on public.personalization_saved_projects (clerk_user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.personalization_saved_projects enable row level security;

-- The Clerk idiom used by every other personalization table in this repo. The
-- GUC is set inside the RPCs below (same transaction), so it is populated for
-- every route call. For a direct PostgREST call from a browser the GUC is
-- absent, the predicate evaluates to NULL, and the row is invisible -- the
-- fail-closed default, which is why the browser never writes this table
-- directly (the server route is the only writer).
drop policy if exists "personalization_saved_projects_select_own" on public.personalization_saved_projects;
create policy "personalization_saved_projects_select_own"
  on public.personalization_saved_projects for select
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "personalization_saved_projects_insert_own" on public.personalization_saved_projects;
create policy "personalization_saved_projects_insert_own"
  on public.personalization_saved_projects for insert
  with check (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "personalization_saved_projects_update_own" on public.personalization_saved_projects;
create policy "personalization_saved_projects_update_own"
  on public.personalization_saved_projects for update
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''))
  with check (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "personalization_saved_projects_delete_own" on public.personalization_saved_projects;
create policy "personalization_saved_projects_delete_own"
  on public.personalization_saved_projects for delete
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

-- ---------------------------------------------------------------------------
-- Ownership RPCs (SECURITY DEFINER, atomic identity + protected operation)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is required so the function can set the GUC and the
-- statement still resolves the RLS policies against it; search_path is pinned
-- to prevent search-path hijacking of the unqualified names.

create or replace function public.personalization_saved_projects_list(p_clerk_user_id text)
returns setof public.personalization_saved_projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'personalization_saved_projects_list: clerk_user_id is required'
      using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  return query
    select * from public.personalization_saved_projects
    where clerk_user_id = p_clerk_user_id
    order by updated_at desc
    limit 50;
end;
$$;

create or replace function public.personalization_saved_projects_get(
  p_id uuid,
  p_clerk_user_id text
)
returns setof public.personalization_saved_projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'personalization_saved_projects_get: clerk_user_id is required'
      using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  return query
    select * from public.personalization_saved_projects
    where id = p_id
      and clerk_user_id = p_clerk_user_id;
end;
$$;

-- Insert-or-update. Ownership is asserted on the existing row before any
-- update, so a caller who supplies another user's id updates zero rows and
-- gets 404 rather than silently succeeding or leaking the row's existence.
create or replace function public.personalization_saved_projects_upsert(
  p_id uuid,
  p_clerk_user_id text,
  p_source jsonb default '{}'::jsonb,
  p_client jsonb default '{}'::jsonb,
  p_assets jsonb default '{}'::jsonb,
  p_prompt jsonb default '{}'::jsonb,
  p_generation jsonb default '{}'::jsonb,
  p_output_type text default 'prompt',
  p_mode text default null,
  p_status text default 'idle',
  p_error_message text default null
)
returns public.personalization_saved_projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.personalization_saved_projects;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'personalization_saved_projects_upsert: clerk_user_id is required'
      using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);

  if p_id is null then
    insert into public.personalization_saved_projects
      (clerk_user_id, source, client, assets, prompt, generation,
       output_type, mode, status, error_message)
    values
      (p_clerk_user_id,
       coalesce(p_source, '{}'::jsonb),
       coalesce(p_client, '{}'::jsonb),
       coalesce(p_assets, '{}'::jsonb),
       coalesce(p_prompt, '{}'::jsonb),
       coalesce(p_generation, '{}'::jsonb),
       coalesce(p_output_type, 'prompt'),
       p_mode,
       coalesce(p_status, 'idle'),
       p_error_message)
    returning * into v_row;
  else
    -- Ownership must be re-checked here, not taken on trust from the caller.
    if not exists (
      select 1 from public.personalization_saved_projects
      where id = p_id and clerk_user_id = p_clerk_user_id
    ) then
      raise exception 'personalization_saved_projects_upsert: project % not owned by caller', p_id
        using errcode = '42501';
    end if;

    update public.personalization_saved_projects
    set source = coalesce(p_source, '{}'::jsonb),
        client = coalesce(p_client, '{}'::jsonb),
        assets = coalesce(p_assets, '{}'::jsonb),
        prompt = coalesce(p_prompt, '{}'::jsonb),
        generation = coalesce(p_generation, '{}'::jsonb),
        output_type = coalesce(p_output_type, 'prompt'),
        mode = p_mode,
        status = coalesce(p_status, 'idle'),
        error_message = p_error_message,
        updated_at = now()
    where id = p_id and clerk_user_id = p_clerk_user_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.personalization_saved_projects_delete(
  p_id uuid,
  p_clerk_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'personalization_saved_projects_delete: clerk_user_id is required'
      using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);

  delete from public.personalization_saved_projects
  where id = p_id and clerk_user_id = p_clerk_user_id;
  get diagnostics v_deleted = row_count;

  return v_deleted > 0;
end;
$$;

-- Grant execute to the server-side roles only. The anon/authenticated browser
-- roles intentionally receive nothing: the server route (service role) is the
-- only writer, and a browser that could call these with an arbitrary
-- clerk_user_id would bypass the session check in the route.
revoke all on function public.personalization_saved_projects_list(text) from public, anon, authenticated;
revoke all on function public.personalization_saved_projects_get(uuid, text) from public, anon, authenticated;
revoke all on function public.personalization_saved_projects_upsert(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.personalization_saved_projects_delete(uuid, text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════
-- from OpenHiggsBolt: 20261014000000_demo_discovery_limits.sql
-- ════════════════════════════════════════════════════════════════════
-- Anonymous demo discovery: cross-instance quota + shared result cache.
--
-- NAMESPACE: this database is shared by several applications, so every object
-- here is named `personalization_demo_*` (matching this app's existing
-- `personalization_*` tables) and is labelled with a `comment on table` at the
-- end of this file, so ownership is unambiguous. Service-role only.
--
-- `lib/rateLimit.ts` keeps its buckets in process memory, so on Netlify every
-- Lambda instance owns its own bucket and a caller that can reach several
-- instances gets several buckets. `POST /api/demo/discover` is an anonymous
-- route that performs outbound HTTP on the operator's behalf, so its limit has
-- to be shared across instances, and the whole "may this caller proceed?"
-- decision has to be atomic (two concurrent invocations must not both read the
-- old count and both pass).
--
-- Two tables, three RPCs, all called only through the service-role client
-- (`src/lib/supabase.ts createServerClient()`), which is what the routes use:
--
--   public.personalization_demo_discovery_limits     + public.personalization_demo_consume_quota(p_key, p_max, p_window_ms)
--   public.personalization_demo_discovery_cache      + public.personalization_demo_discovery_cache_get(p_url)
--                                   + public.personalization_demo_discovery_cache_put(p_url, p_payload, p_ttl_ms)
--
-- No identity is stored anywhere. `personalization_demo_discovery_limits.p_key` is a rate-limit
-- key (an anonymous IP, or the single shared `anon` bucket) and
-- `personalization_demo_discovery_cache.cache_key` is the canonical website URL. The cache row
-- holds only the public asset list of a public website -- no user data, no IP,
-- no token.
--
-- FAIL CLOSED is the route's job and the database's: the RPCs validate their
-- arguments and raise rather than guess, RLS is enabled with no policies (so a
-- browser client with the anon key can neither read nor write), and execute is
-- revoked from public/anon/authenticated so only the server-side role can call
-- them. If Supabase is unreachable the route answers 503 instead of letting
-- unlimited anonymous traffic through.

-- ---------------------------------------------------------------------------
-- Table: personalization_demo_discovery_limits
-- ---------------------------------------------------------------------------

create table if not exists public.personalization_demo_discovery_limits (
  quota_key         text primary key,
  window_started_at timestamptz not null default now(),
  window_expires_at timestamptz not null default now(),
  request_count     integer not null default 1,
  updated_at        timestamptz not null default now(),
  constraint pz_demo_limits_request_count_non_negative
    check (request_count >= 0)
);

comment on table public.personalization_demo_discovery_limits is
  'Cross-instance request counters for the anonymous demo endpoint. Keyed by a rate-limit key (anonymous IP), never by a user identity.';

create index if not exists personalization_demo_discovery_limits_window_expires_at_idx
  on public.personalization_demo_discovery_limits (window_expires_at);

-- ---------------------------------------------------------------------------
-- Table: personalization_demo_discovery_cache
-- ---------------------------------------------------------------------------

create table if not exists public.personalization_demo_discovery_cache (
  cache_key  text primary key,
  payload    jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.personalization_demo_discovery_cache is
  'Shared demo discovery results keyed by canonical website URL. Holds the public asset list only: no caller identity, IP or token.';

create index if not exists personalization_demo_discovery_cache_expires_at_idx
  on public.personalization_demo_discovery_cache (expires_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Enabled with no policies: the fail-closed default for a browser/anon client.
-- The route is the only reader and writer, through the service role.

alter table public.personalization_demo_discovery_limits enable row level security;
alter table public.personalization_demo_discovery_cache enable row level security;

-- ---------------------------------------------------------------------------
-- RPC: personalization_demo_consume_quota(p_key text, p_max int, p_window_ms bigint)
-- ---------------------------------------------------------------------------
-- Atomically increments the counter for `p_key` inside a single INSERT ... ON
-- CONFLICT DO UPDATE, so concurrent invocations cannot both observe the
-- pre-increment count. A window that has already expired restarts at 1 rather
-- than continuing to count against the old window.
--
-- Returns jsonb: { allowed, remaining, retry_after_ms, window_expires_at }.
-- `allowed` is false once the count passes p_max, and `retry_after_ms` is the
-- time left in the current window so the route can set Retry-After.
--
-- SECURITY DEFINER so the function owns the write regardless of the calling
-- role; search_path is pinned to prevent search-path hijacking.

create or replace function public.personalization_demo_consume_quota(
  p_key text,
  p_max integer,
  p_window_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_count integer;
  v_window_expires timestamptz;
  v_allowed boolean;
  v_retry_after_ms bigint;
  v_window_seconds double precision;
begin
  if p_key is null or btrim(p_key) = '' then
    raise exception 'personalization_demo_consume_quota: p_key is required'
      using errcode = '22023';
  end if;
  if p_max is null or p_max < 1 then
    raise exception 'personalization_demo_consume_quota: p_max must be at least 1'
      using errcode = '22023';
  end if;
  if p_window_ms is null or p_window_ms < 1000 then
    raise exception 'personalization_demo_consume_quota: p_window_ms must be at least 1000'
      using errcode = '22023';
  end if;

  v_window_seconds := (p_window_ms::double precision / 1000.0);

  insert into public.personalization_demo_discovery_limits
    (quota_key, window_started_at, window_expires_at, request_count, updated_at)
  values
    (p_key,
     now(),
     now() + make_interval(secs => v_window_seconds),
     1,
     now())
  on conflict (quota_key) do update
    set request_count = case
          when personalization_demo_discovery_limits.window_expires_at <= now() then 1
          else personalization_demo_discovery_limits.request_count + 1
        end,
        window_started_at = case
          when personalization_demo_discovery_limits.window_expires_at <= now() then now()
          else personalization_demo_discovery_limits.window_started_at
        end,
        window_expires_at = case
          when personalization_demo_discovery_limits.window_expires_at <= now()
            then now() + make_interval(secs => v_window_seconds)
          else personalization_demo_discovery_limits.window_expires_at
        end,
        updated_at = now()
  returning request_count, window_expires_at
  into v_request_count, v_window_expires;

  v_allowed := v_request_count <= p_max;
  v_retry_after_ms := case
    when v_allowed then 0
    else greatest(
      0,
      ceil(extract(epoch from (v_window_expires - now())) * 1000)
    )::bigint
  end;

  return jsonb_build_object(
    'allowed', v_allowed,
    'remaining', greatest(0, p_max - v_request_count),
    'retry_after_ms', v_retry_after_ms,
    'window_expires_at',
      to_char(v_window_expires at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: personalization_demo_discovery_cache_get(p_url text)
-- ---------------------------------------------------------------------------
-- Returns the cached payload for `p_url`, or NULL when there is no row or the
-- row's TTL has elapsed. Expiry is evaluated by the database, so every
-- instance agrees on freshness.

create or replace function public.personalization_demo_discovery_cache_get(p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payload jsonb;
begin
  if p_url is null or btrim(p_url) = '' then
    return null;
  end if;

  select payload into v_payload
  from public.personalization_demo_discovery_cache
  where cache_key = p_url
    and expires_at > now();

  return v_payload;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: personalization_demo_discovery_cache_put(p_url text, p_payload jsonb, p_ttl_ms bigint)
-- ---------------------------------------------------------------------------
-- Upsert: a Netlify fan-out that crawls the same site concurrently converges on
-- one row instead of duplicating work. `p_ttl_ms` is supplied by the route
-- (6 hours) so the freshness policy stays in code.

create or replace function public.personalization_demo_discovery_cache_put(
  p_url text,
  p_payload jsonb,
  p_ttl_ms bigint
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ttl_ms bigint;
begin
  if p_url is null or btrim(p_url) = '' or p_payload is null then
    return;
  end if;

  v_ttl_ms := case
    when p_ttl_ms is null or p_ttl_ms < 0 then 0
    else p_ttl_ms
  end;

  insert into public.personalization_demo_discovery_cache
    (cache_key, payload, expires_at, created_at, updated_at)
  values
    (p_url,
     p_payload,
     now() + make_interval(secs => (v_ttl_ms::double precision / 1000.0)),
     now(),
     now())
  on conflict (cache_key) do update
    set payload = excluded.payload,
        expires_at = excluded.expires_at,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Server-side role only. The anon and authenticated browser roles receive
-- nothing: the anon key ships in the browser bundle, and a caller that could
-- invoke these directly could mint quota buckets or poison the shared cache.

revoke all on function public.personalization_demo_consume_quota(text, integer, bigint) from public, anon, authenticated;
revoke all on function public.personalization_demo_discovery_cache_get(text) from public, anon, authenticated;
revoke all on function public.personalization_demo_discovery_cache_put(text, jsonb, bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ownership labels (this database is shared by several applications).
-- ---------------------------------------------------------------------------
comment on table public.personalization_demo_discovery_limits is
  'OpenHiggsBolt / SmartVideo GO - anonymous Find-My-Brand discovery rate limiting. '
  'Cross-instance quota counters for POST /api/demo/discover (src/server/demoRateLimit.ts). '
  'Shared database: namespaced personalization_demo_*. Service-role only.';

comment on table public.personalization_demo_discovery_cache is
  'OpenHiggsBolt / SmartVideo GO - shared cache of anonymous discovery results. '
  'Public asset URLs and page metadata only, no customer data (src/server/demoDiscovery.ts). '
  'Shared database: namespaced personalization_demo_*. Service-role only.';

-- ════════════════════════════════════════════════════════════════════
-- from OpenHiggsBolt: 20261021000000_lead_finder_leads.sql
-- ════════════════════════════════════════════════════════════════════
-- Lead Finder lead management: per-user shortlist with pipeline stages.
--
-- WHY A DEDICATED TABLE
-- There is no lead/shortlist/prospect persistence anywhere in this repo yet:
-- the Lead Finder search results are recomputed from OpenStreetMap on every
-- request and thrown away, so a user cannot keep a shortlist, move a lead
-- through a pipeline, or annotate it. This migration adds that storage
-- without touching any existing table, because every other personalization
-- table in this schema carries constraints that belong to a different
-- feature (see 20261013000000_personalization_saved_projects.sql for the
-- same reasoning applied to saved projects).
--
-- The ownership model uses the Clerk identity (clerk_user_id text), matching
-- every other personalization table in this repo. There is no FK to
-- auth.users: Clerk is the identity provider here, so a Clerk user id can
-- never satisfy a Supabase auth.uid() reference.
--
-- OWNERSHIP IS ENFORCED IN THE DATABASE, ATOMICALLY. A route that ran
--   await supabase.rpc('set_config', {setting:'app.clerk_user_id', is_local:true})
--   await supabase.from(...).select(...)
-- as two separate HTTP round-trips would be broken: PostgREST serves each
-- request from a connection pool, so `set_config(..., is_local => true)` is
-- scoped to the *first* request's transaction and is discarded before the
-- second one runs; the GUC the RLS policies read is therefore empty and the
-- policies match nothing. The functions below accept the identity as an
-- explicit parameter and call set_config inside the SAME transaction as the
-- protected operation, so the ownership check is both atomic and correct.
--
-- A lead is identified by its OpenStreetMap record id (`business_id`, e.g.
-- 'osm-node-123') scoped to the owner, which is what the UNIQUE constraint
-- encodes: re-saving the same business updates the existing lead instead of
-- creating a duplicate. The full BusinessDiscoveryRecord snapshot is stored
-- in `business` so a saved lead still renders (and stays scorable) after the
-- upstream OpenStreetMap response changes.
--
-- The `stage` vocabulary is duplicated in exactly one other place:
-- src/shared/personalization/leadStages.ts. The CHECK constraint below is the
-- backstop that rejects an unknown stage even when the API is bypassed.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.lead_finder_leads (
  id            uuid primary key default gen_random_uuid(),
  clerk_user_id text not null,
  -- OpenStreetMap record id of the prospect (e.g. 'osm-node-123').
  business_id   text not null,
  -- Full BusinessDiscoveryRecord snapshot taken when the lead was saved.
  business      jsonb not null default '{}'::jsonb,
  stage         text not null default 'New',
  notes         text,
  starred       boolean not null default false,
  niche         text,
  location      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lead_finder_leads_stage_check
    check (stage in ('New', 'Qualified', 'Shortlisted', 'Demo Created',
                     'Contacted', 'Responded', 'Converted', 'Not Interested')),
  -- Re-saving the same business updates the existing lead instead of
  -- duplicating it. The owner is part of the key: two users may legitimately
  -- shortlist the same business.
  constraint lead_finder_leads_owner_business_key
    unique (clerk_user_id, business_id)
);

comment on table public.lead_finder_leads is
  'Lead Finder shortlist and pipeline, owned by a Clerk user id. See app/api/personalization/leads/route.ts.';

-- The list view is "this owner's leads, most recently touched first".
create index if not exists lead_finder_leads_clerk_updated_at_idx
  on public.lead_finder_leads (clerk_user_id, updated_at desc);

-- The pipeline view filters by stage for one owner.
create index if not exists lead_finder_leads_clerk_stage_idx
  on public.lead_finder_leads (clerk_user_id, stage);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.lead_finder_leads enable row level security;

-- The Clerk idiom used by every other personalization table in this repo. The
-- GUC is set inside the RPCs below (same transaction), so it is populated for
-- every route call. For a direct PostgREST call from a browser the GUC is
-- absent, the predicate evaluates to NULL, and the row is invisible -- the
-- fail-closed default, which is why the browser never writes this table
-- directly (the server route is the only writer).
drop policy if exists "lead_finder_leads_select_own" on public.lead_finder_leads;
create policy "lead_finder_leads_select_own"
  on public.lead_finder_leads for select
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "lead_finder_leads_insert_own" on public.lead_finder_leads;
create policy "lead_finder_leads_insert_own"
  on public.lead_finder_leads for insert
  with check (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "lead_finder_leads_update_own" on public.lead_finder_leads;
create policy "lead_finder_leads_update_own"
  on public.lead_finder_leads for update
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''))
  with check (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

drop policy if exists "lead_finder_leads_delete_own" on public.lead_finder_leads;
create policy "lead_finder_leads_delete_own"
  on public.lead_finder_leads for delete
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));

-- ---------------------------------------------------------------------------
-- Ownership RPCs (SECURITY DEFINER, atomic identity + protected operation)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER is required so the function can set the GUC and the
-- statement still resolves the RLS policies against it; search_path is pinned
-- to prevent search-path hijacking of the unqualified names.

create or replace function public.lead_finder_leads_list(p_clerk_user_id text)
returns setof public.lead_finder_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'lead_finder_leads_list: clerk_user_id is required'
      using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  -- The cap keeps a single request from streaming an unbounded pipeline
  -- board; the route paginates by narrowing, not by offsetting.
  return query
    select * from public.lead_finder_leads
    where clerk_user_id = p_clerk_user_id
    order by updated_at desc
    limit 200;
end;
$$;

-- Insert-or-update. Ownership is asserted on the existing row before any
-- update, so a caller who supplies another user's id updates zero rows and
-- gets 404 rather than silently succeeding or leaking the row's existence.
--
-- A NULL argument means "not specified": on the update path the stored value
-- is preserved, so a partial PATCH (stage only) never wipes the business
-- snapshot, the notes, or the star flag. Only the insert path substitutes
-- the defaults.
create or replace function public.lead_finder_leads_upsert(
  p_id uuid,
  p_clerk_user_id text,
  p_business_id text,
  p_business jsonb default null,
  p_stage text default null,
  p_notes text default null,
  p_starred boolean default null,
  p_niche text default null,
  p_location text default null
)
returns public.lead_finder_leads
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.lead_finder_leads;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'lead_finder_leads_upsert: clerk_user_id is required'
      using errcode = '28000';
  end if;
  -- Defense in depth: the CHECK constraint also rejects an unknown stage,
  -- but validating here yields a precise error instead of a constraint
  -- violation.
  if p_stage is not null and p_stage not in (
    'New', 'Qualified', 'Shortlisted', 'Demo Created',
    'Contacted', 'Responded', 'Converted', 'Not Interested'
  ) then
    raise exception 'lead_finder_leads_upsert: invalid stage %', p_stage
      using errcode = '22023';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);

  if p_id is null then
    if p_business_id is null or p_business_id = '' then
      raise exception 'lead_finder_leads_upsert: business_id is required'
        using errcode = '22023';
    end if;

    insert into public.lead_finder_leads as lfl
      (clerk_user_id, business_id, business, stage, notes, starred, niche, location)
    values
      (p_clerk_user_id,
       p_business_id,
       coalesce(p_business, '{}'::jsonb),
       coalesce(p_stage, 'New'),
       p_notes,
       coalesce(p_starred, false),
       p_niche,
       p_location)
    on conflict (clerk_user_id, business_id) do update
      set business = excluded.business,
          -- A re-save that did not mention a stage (or a star flag) must not
          -- reset what the user already set on the lead.
          stage = case when p_stage is null then lfl.stage else excluded.stage end,
          notes = case when p_notes is null then lfl.notes else excluded.notes end,
          starred = case when p_starred is null then lfl.starred else excluded.starred end,
          niche = case when p_niche is null then lfl.niche else excluded.niche end,
          location = case when p_location is null then lfl.location else excluded.location end,
          updated_at = now()
    returning * into v_row;
  else
    -- Ownership must be re-checked here, not taken on trust from the caller.
    if not exists (
      select 1 from public.lead_finder_leads
      where id = p_id and clerk_user_id = p_clerk_user_id
    ) then
      raise exception 'lead_finder_leads_upsert: lead % not owned by caller', p_id
        using errcode = '42501';
    end if;

    update public.lead_finder_leads
    set business_id = coalesce(p_business_id, business_id),
        business = coalesce(p_business, business),
        stage = coalesce(p_stage, stage),
        notes = coalesce(p_notes, notes),
        starred = coalesce(p_starred, starred),
        niche = coalesce(p_niche, niche),
        location = coalesce(p_location, location),
        updated_at = now()
    where id = p_id and clerk_user_id = p_clerk_user_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.lead_finder_leads_delete(
  p_id uuid,
  p_clerk_user_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'lead_finder_leads_delete: clerk_user_id is required'
      using errcode = '28000';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);

  delete from public.lead_finder_leads
  where id = p_id and clerk_user_id = p_clerk_user_id;
  get diagnostics v_deleted = row_count;

  return v_deleted > 0;
end;
$$;

-- Grant execute to the server-side roles only. The anon/authenticated browser
-- roles intentionally receive nothing: the server route (service role) is the
-- only writer, and a browser that could call these with an arbitrary
-- clerk_user_id would bypass the session check in the route.
revoke all on function public.lead_finder_leads_list(text) from public, anon, authenticated;
revoke all on function public.lead_finder_leads_upsert(uuid, text, text, jsonb, text, text, boolean, text, text) from public, anon, authenticated;
revoke all on function public.lead_finder_leads_delete(uuid, text) from public, anon, authenticated;

-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and `service_role` is a
-- member of PUBLIC, so the revokes above would leave the server route unable
-- to call the RPCs on a fresh environment. Grant it back explicitly.
grant execute on function public.lead_finder_leads_list(text) to service_role;
grant execute on function public.lead_finder_leads_upsert(uuid, text, text, jsonb, text, text, boolean, text, text) to service_role;
grant execute on function public.lead_finder_leads_delete(uuid, text) to service_role;

-- ════════════════════════════════════════════════════════════════════
-- from OpenHiggsBolt: 20261024000000_personalization_saved_projects_list_by_source.sql
-- ════════════════════════════════════════════════════════════════════
-- Source-scoped saved-project list.
--
-- `personalization_saved_projects_list` returns the caller's 50 most recently
-- updated rows. The project route used to narrow that list to one source demo
-- AFTER the limit, so a source whose latest row was older than the caller's 50
-- newest rows could never be restored. This function applies the source filter
-- inside the query, before the limit.
--
-- The demo id lives at `source->>'id'` (see `projectRowFromState` in
-- `src/shared/personalization/supabaseProjectPersistence.ts` and
-- `readSourceDemoId` in `app/api/personalization/project/route.ts`).
--
-- Same ownership model as the other saved-project RPCs: SECURITY DEFINER, the
-- identity is set as the GUC the RLS policies read, search_path is pinned, and
-- only the server-side roles may execute it.

create or replace function public.personalization_saved_projects_list_by_source(
  p_clerk_user_id text,
  p_source_id text
)
returns setof public.personalization_saved_projects
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_clerk_user_id is null or p_clerk_user_id = '' then
    raise exception 'personalization_saved_projects_list_by_source: clerk_user_id is required'
      using errcode = '28000';
  end if;
  if p_source_id is null or p_source_id = '' then
    raise exception 'personalization_saved_projects_list_by_source: source_id is required'
      using errcode = '22023';
  end if;
  perform set_config('app.clerk_user_id', p_clerk_user_id, true);
  return query
    select * from public.personalization_saved_projects
    where clerk_user_id = p_clerk_user_id
      and source->>'id' = p_source_id
    order by updated_at desc
    limit 50;
end;
$$;

-- Supports the per-user, per-source lookup above.
create index if not exists personalization_saved_projects_user_source_updated_idx
  on public.personalization_saved_projects (clerk_user_id, (source->>'id'), updated_at desc);

revoke all on function public.personalization_saved_projects_list_by_source(text, text) from public, anon, authenticated;

-- remix: CREATE FUNCTION grants EXECUTE through PUBLIC, and the revokes above
-- remove that path for service_role too (the same reason the lead_finder
-- RPCs are re-granted above). The Netlify function calls every one of these
-- RPCs with the service role, so grant it explicitly.
grant execute on function public.personalization_saved_projects_list(text) to service_role;
grant execute on function public.personalization_saved_projects_get(uuid, text) to service_role;
grant execute on function public.personalization_saved_projects_upsert(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, text, text) to service_role;
grant execute on function public.personalization_saved_projects_delete(uuid, text) to service_role;
grant execute on function public.personalization_saved_projects_list_by_source(text, text) to service_role;
grant execute on function public.personalization_demo_consume_quota(text, integer, bigint) to service_role;
grant execute on function public.personalization_demo_discovery_cache_get(text) to service_role;
grant execute on function public.personalization_demo_discovery_cache_put(text, jsonb, bigint) to service_role;

-- ════════════════════════════════════════════════════════════════════
-- remix: storage buckets the ported modal writes to
-- ════════════════════════════════════════════════════════════════════
--   * personalization-assets — durable originals of uploaded brand/person
--     assets, written by the browser upload adapter under
--     <workspace>/<asset>/… (src/features/personalization/lib/muapiUpload.ts)
--   * brand-assets           — edited images saved by
--     /api/personalization/persist-edited-asset (service role)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('personalization-assets', 'personalization-assets', true, 104857600,
   array['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime',
         -- every audio type the background-audio picker accepts
         -- (shared/personalization/guided/audioTrack.ts MIME_BY_FORMAT)
         'audio/mpeg','audio/mp3',
         'audio/mp4','audio/x-m4a','audio/m4a',
         'audio/wav','audio/x-wav','audio/wave','audio/vnd.wave',
         'audio/ogg','application/ogg',
         'audio/aac','audio/aacp','audio/x-aac']),
  ('brand-assets', 'brand-assets', true, 10485760,
   array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml'])
on conflict (id) do update
  set allowed_mime_types = excluded.allowed_mime_types,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "personalization-assets public read" on storage.objects;
create policy "personalization-assets public read"
  on storage.objects for select
  using (bucket_id = 'personalization-assets');

-- Writes are owner-scoped: the first path segment is the uploader's
-- workspace folder, `smartvideo-go-clerk-<clerk user id>` (getStableUserId +
-- muapiDurableObjectPath). A signed-in user can create and replace objects
-- only inside their own folder, so nobody can overwrite another user's asset
-- even though reads are public.
drop policy if exists "personalization-assets authenticated write" on storage.objects;
drop policy if exists "personalization-assets owner insert" on storage.objects;
create policy "personalization-assets owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'personalization-assets'
    and coalesce(auth.jwt() ->> 'sub', '') <> ''
    and (storage.foldername(name))[1] = 'smartvideo-go-clerk-' || (auth.jwt() ->> 'sub')
  );

drop policy if exists "personalization-assets authenticated update" on storage.objects;
drop policy if exists "personalization-assets owner update" on storage.objects;
create policy "personalization-assets owner update"
  on storage.objects for update
  using (
    bucket_id = 'personalization-assets'
    and coalesce(auth.jwt() ->> 'sub', '') <> ''
    and (storage.foldername(name))[1] = 'smartvideo-go-clerk-' || (auth.jwt() ->> 'sub')
  )
  with check (
    bucket_id = 'personalization-assets'
    and (storage.foldername(name))[1] = 'smartvideo-go-clerk-' || (auth.jwt() ->> 'sub')
  );

drop policy if exists "brand-assets public read" on storage.objects;
create policy "brand-assets public read"
  on storage.objects for select
  using (bucket_id = 'brand-assets');
