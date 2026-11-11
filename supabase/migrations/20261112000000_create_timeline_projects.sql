-- ===========================================================================
-- create_timeline_projects.sql
--
-- Durable, per-owner storage for Timeline Editor projects (the "Projects"
-- section). src/lib/editor/persistence.js already targeted this table name;
-- it was never created. Same identity model as published_videos / video_leads:
-- the verified Clerk `sub` minted into the Supabase JWT.
--
-- The editable source lives in `data`; render + thumbnail metadata are
-- separate columns so publishing / rendering never overwrites the source.
-- parent_project_id links a follow-up (retarget) project to its original.
-- The legacy open `public.projects` table is deliberately NOT used.
-- ===========================================================================

create table if not exists public.timeline_projects (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  name text not null default 'Untitled project'
    check (char_length(name) between 1 and 200),
  data jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  thumbnail_url text,
  duration_s numeric check (duration_s is null or duration_s >= 0),
  aspect_ratio text check (aspect_ratio is null or char_length(aspect_ratio) <= 16),
  render jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  parent_project_id uuid references public.timeline_projects(id) on delete set null,
  followup_context jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_projects_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint timeline_projects_data_size check (pg_column_size(data) < 8388608),
  constraint timeline_projects_render_is_object check (jsonb_typeof(render) = 'object'),
  constraint timeline_projects_settings_is_object check (jsonb_typeof(settings) = 'object')
);

create index if not exists timeline_projects_owner_idx
  on public.timeline_projects (clerk_user_id, updated_at desc)
  where deleted_at is null;
create index if not exists timeline_projects_parent_idx
  on public.timeline_projects (parent_project_id)
  where parent_project_id is not null;

alter table public.timeline_projects enable row level security;

drop policy if exists "Owners read own projects" on public.timeline_projects;
drop policy if exists "Owners insert own projects" on public.timeline_projects;
drop policy if exists "Owners update own projects" on public.timeline_projects;
drop policy if exists "Owners delete own projects" on public.timeline_projects;

create policy "Owners read own projects"
  on public.timeline_projects for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners insert own projects"
  on public.timeline_projects for insert to authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners update own projects"
  on public.timeline_projects for update to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners delete own projects"
  on public.timeline_projects for delete to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- No anon access: private projects. Least privilege for API roles.
revoke all on public.timeline_projects from anon, authenticated;
grant select, insert, update, delete on public.timeline_projects to authenticated;

-- Owner / created_at are immutable for API roles; updated_at is server-set.
create or replace function public.timeline_projects_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated') then
    new.clerk_user_id := old.clerk_user_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.timeline_projects_guard() from public;

drop trigger if exists timeline_projects_guard on public.timeline_projects;
create trigger timeline_projects_guard
  before insert or update on public.timeline_projects
  for each row execute function public.timeline_projects_guard();

-- ---------------------------------------------------------------------------
-- Link published videos to their editable source project.
-- Publishing never copies over / destroys the project: the published row keeps
-- an immutable snapshot (`project` jsonb) and merely references the source.
-- ---------------------------------------------------------------------------
alter table public.published_videos
  add column if not exists project_id uuid;

create index if not exists published_videos_project_idx
  on public.published_videos (project_id)
  where project_id is not null;

-- A video may only reference a project owned by the same user.
create or replace function public.published_videos_check_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is not null and not exists (
    select 1 from public.timeline_projects p
    where p.id = new.project_id and p.clerk_user_id = new.clerk_user_id
  ) then
    raise exception 'project_id does not belong to the video owner' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.published_videos_check_project() from public;

drop trigger if exists published_videos_check_project on public.published_videos;
create trigger published_videos_check_project
  before insert or update of project_id on public.published_videos
  for each row execute function public.published_videos_check_project();
