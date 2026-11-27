-- ===========================================================================
-- create_storyboard_projects.sql
--
-- Storyboard Studio projects saved to the user's account, so a storyboard
-- follows them across browsers and devices. The studio always keeps a local
-- copy too; this table is the optional cloud copy for signed-in users.
--
--   clerk_user_id owner: the verified Clerk `sub` carried by the Supabase JWT
--                 minted by netlify/functions/supabase-token (role
--                 'authenticated'). Same identity model as
--                 20261105120000_create_published_videos.sql.
--   name          the project name the user typed (unique per owner)
--   project       { frames, brief, settings, layout, selectedModel, ... }
--                 Inline (data:) images are stripped client-side; only web
--                 URLs are synced.
--
-- RLS: strictly owner-only. There is deliberately NO public/anon access: a
-- caller without a verified JWT has a null `sub`, which matches no row and
-- cannot insert (clerk_user_id is NOT NULL with no usable default).
-- ===========================================================================

create table if not exists public.storyboard_projects (
  clerk_user_id text not null default (auth.jwt() ->> 'sub')
    check (clerk_user_id <> ''),
  name text not null
    check (char_length(name) between 1 and 120),
  project jsonb not null,
  frame_count integer not null default 0
    check (frame_count between 0 and 200),
  total_seconds integer not null default 0
    check (total_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (clerk_user_id, name),
  constraint storyboard_projects_project_is_object check (jsonb_typeof(project) = 'object'),
  constraint storyboard_projects_project_size check (pg_column_size(project) < 1572864)
);

create index if not exists storyboard_projects_owner_updated_idx
  on public.storyboard_projects (clerk_user_id, updated_at desc);

alter table public.storyboard_projects enable row level security;

drop policy if exists "Owners read own storyboards" on public.storyboard_projects;
drop policy if exists "Owners insert own storyboards" on public.storyboard_projects;
drop policy if exists "Owners update own storyboards" on public.storyboard_projects;
drop policy if exists "Owners delete own storyboards" on public.storyboard_projects;

create policy "Owners read own storyboards"
  on public.storyboard_projects
  for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners insert own storyboards"
  on public.storyboard_projects
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners update own storyboards"
  on public.storyboard_projects
  for update
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners delete own storyboards"
  on public.storyboard_projects
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- Only the privileges the policies are written for (no TRUNCATE, which would
-- bypass RLS, and nothing for anon).
revoke all on public.storyboard_projects from anon;
revoke truncate, references, trigger on public.storyboard_projects from authenticated;
grant select, insert, update, delete on public.storyboard_projects to authenticated;

-- Server-authoritative bookkeeping: the owner and created_at can't be changed
-- by an update, updated_at always reflects the server clock, and one account
-- can hold at most 100 storyboards.
create or replace function public.storyboard_projects_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- An upsert of an existing name fires this trigger too; only a genuinely
    -- new project counts against the limit.
    if not exists (select 1 from public.storyboard_projects
                    where clerk_user_id = new.clerk_user_id and name = new.name)
       and (select count(*) from public.storyboard_projects where clerk_user_id = new.clerk_user_id) >= 100 then
      raise exception 'storyboard limit reached (100 per account)' using errcode = 'check_violation';
    end if;
    new.created_at := now();
  elsif tg_op = 'UPDATE' then
    new.clerk_user_id := old.clerk_user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.storyboard_projects_guard() from public, anon, authenticated;

drop trigger if exists storyboard_projects_guard on public.storyboard_projects;
create trigger storyboard_projects_guard
  before insert or update on public.storyboard_projects
  for each row execute function public.storyboard_projects_guard();
