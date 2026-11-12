-- ===========================================================================
-- business_asset_library.sql  (additive)
--
-- Persistent per-business asset library for the Personalization workflow.
-- Discovered / uploaded / AI-generated assets belong to a business profile and
-- are reusable across videos; asset_assignments binds an asset to a named slot
-- (logo, serviceImage, ...) of one project.
--
-- Owner identity: verified Clerk `sub` (same model as published_videos).
-- storage_url must be a durable http(s) URL, never blob:/data:.
-- ===========================================================================

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  name text not null check (char_length(name) between 1 and 200),
  website text check (website is null or char_length(website) <= 500),
  phone text check (phone is null or char_length(phone) <= 40),
  address text check (address is null or char_length(address) <= 500),
  -- normalized website host (or lower(name) when no website): dedupe key per owner
  business_key text not null check (char_length(business_key) between 1 and 300),
  source text not null default 'manual'
    check (source in ('manual', 'business-finder', 'imported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clerk_user_id, business_key)
);

create table if not exists public.business_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  category text not null default 'image'
    check (category in ('logo', 'image', 'product', 'service', 'team', 'premises', 'website')),
  origin text not null default 'discovered'
    check (origin in ('discovered', 'uploaded', 'ai-generated')),
  state text not null default 'imported'
    check (state in ('discovered', 'imported', 'assigned', 'used')),
  source_url text check (source_url is null or char_length(source_url) <= 2000),
  storage_url text not null
    check (storage_url ~ '^https?://' and char_length(storage_url) <= 2000),
  mime text,
  width integer,
  height integer,
  thumb_url text check (thumb_url is null or thumb_url ~ '^https?://'),
  meta jsonb not null default '{}'::jsonb
    check (jsonb_typeof(meta) = 'object' and pg_column_size(meta) < 32768),
  imported_at timestamptz not null default now(),
  unique (business_id, storage_url)
);

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  project_id text not null check (char_length(project_id) between 1 and 200),
  business_id uuid not null references public.business_profiles (id) on delete cascade,
  slot text not null check (slot ~ '^[A-Za-z][A-Za-z0-9_]{0,63}$'),
  asset_id uuid references public.business_assets (id) on delete set null,
  -- manual = chosen by the user; automatic assignment must not overwrite it
  manual boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (project_id, business_id, slot)
);

create index if not exists business_profiles_owner_idx on public.business_profiles (clerk_user_id, updated_at desc);
create index if not exists business_assets_business_idx on public.business_assets (business_id, category);
create index if not exists asset_assignments_project_idx on public.asset_assignments (clerk_user_id, project_id);

alter table public.business_profiles enable row level security;
alter table public.business_assets enable row level security;
alter table public.asset_assignments enable row level security;

drop policy if exists "business_profiles_owner_all" on public.business_profiles;
drop policy if exists "business_assets_owner_all" on public.business_assets;
drop policy if exists "asset_assignments_owner_all" on public.asset_assignments;

create policy "business_profiles_owner_all" on public.business_profiles
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- Assets/assignments must also point at a business the caller owns, so one
-- account can never attach rows to another account's business.
create policy "business_assets_owner_all" on public.business_assets
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (select 1 from public.business_profiles b
                where b.id = business_id and b.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );

create policy "asset_assignments_owner_all" on public.asset_assignments
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (select 1 from public.business_profiles b
                where b.id = business_id and b.clerk_user_id = (select auth.jwt() ->> 'sub'))
    and (asset_id is null or exists (select 1 from public.business_assets a
                where a.id = asset_id and a.business_id = asset_assignments.business_id))
  );

revoke all on public.business_profiles, public.business_assets, public.asset_assignments from anon;
revoke truncate, references, trigger on public.business_profiles, public.business_assets, public.asset_assignments from authenticated;
grant select, insert, update, delete on public.business_profiles, public.business_assets, public.asset_assignments to authenticated;

-- Owner and timestamps are not client-controlled on update.
create or replace function public.business_library_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated') then
    new.clerk_user_id := old.clerk_user_id;
  end if;
  if tg_table_name <> 'business_assets' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists business_profiles_guard on public.business_profiles;
create trigger business_profiles_guard before update on public.business_profiles
  for each row execute function public.business_library_guard();
drop trigger if exists business_assets_guard on public.business_assets;
create trigger business_assets_guard before update on public.business_assets
  for each row execute function public.business_library_guard();
drop trigger if exists asset_assignments_guard on public.asset_assignments;
create trigger asset_assignments_guard before update on public.asset_assignments
  for each row execute function public.business_library_guard();
