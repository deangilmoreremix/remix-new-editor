-- ===========================================================================
-- create_published_videos.sql
--
-- Interactive videos published from the timeline editor ("Share" panel).
-- A row holds a snapshot of the timeline (tracks, length, List Builder) that
-- the public viewer page (/watch/<id>) plays with its interactive addons:
-- pause, loop, skip, Lead Generator, CTA, List Builder / Personalizer.
--
--   id            unguessable share slug (generated client-side)
--   clerk_user_id owner — the verified Clerk `sub` (same identity model as
--                 20261104120000_create_video_leads.sql)
--   project       { version, title, timelineSeconds, tracks, listBuilder }
--
-- RLS: owners manage their own rows; anyone can read rows that are
-- published (the slug is the capability). View counts go through
-- increment_video_view(), which can only bump the counter.
-- Viewer leads are stored by the lead-capture edge function with the
-- service role, for the video's owner, after checking the video is published.
-- ===========================================================================

create table if not exists public.published_videos (
  id text primary key
    check (id ~ '^[A-Za-z0-9_-]{8,32}$'),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  title text not null default 'Untitled video'
    check (char_length(title) <= 200),
  project jsonb not null,
  published boolean not null default true,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_videos_project_is_object check (jsonb_typeof(project) = 'object'),
  constraint published_videos_project_size check (pg_column_size(project) < 2097152)
);

create index if not exists published_videos_owner_idx
  on public.published_videos (clerk_user_id, updated_at desc);

alter table public.published_videos enable row level security;

drop policy if exists "Anyone reads published videos" on public.published_videos;
drop policy if exists "Owners read own videos" on public.published_videos;
drop policy if exists "Owners insert own videos" on public.published_videos;
drop policy if exists "Owners update own videos" on public.published_videos;
drop policy if exists "Owners delete own videos" on public.published_videos;

create policy "Anyone reads published videos"
  on public.published_videos
  for select
  to anon, authenticated
  using (published = true);

create policy "Owners read own videos"
  on public.published_videos
  for select
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners insert own videos"
  on public.published_videos
  for insert
  to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners update own videos"
  on public.published_videos
  for update
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners delete own videos"
  on public.published_videos
  for delete
  to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

grant select, insert, update, delete on public.published_videos to anon, authenticated;

-- Owners (API roles) can't change view_count, created_at or the owner
-- through updates; increment_video_view runs as the function owner.
create or replace function public.published_videos_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and current_user in ('anon', 'authenticated') then
    new.view_count := 0;
  end if;
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated') then
    new.view_count := old.view_count;
    new.created_at := old.created_at;
    new.clerk_user_id := old.clerk_user_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists published_videos_guard on public.published_videos;
create trigger published_videos_guard
  before insert or update on public.published_videos
  for each row execute function public.published_videos_guard();

-- Public view counter: increments only, only for published rows.
create or replace function public.increment_video_view(video_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.published_videos
     set view_count = view_count + 1
   where id = video_id and published = true;
$$;

revoke all on function public.increment_video_view(text) from public;
grant execute on function public.increment_video_view(text) to anon, authenticated;
