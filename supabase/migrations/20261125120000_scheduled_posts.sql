-- ===========================================================================
-- scheduled_posts.sql
--
-- The "Schedule post" window on every studio result: one row per social post a
-- signed-in person wrote (with the AI writer or by hand) and scheduled. This is
-- a queue: nothing here posts to a social network yet. A posting service can
-- read `status = 'scheduled'` rows later without changing the window.
--
-- Identity model matches template_favorites and landing_pages: the verified
-- Clerk `sub`. Hardening-safe: explicit RLS, GRANT and REVOKE.
-- ===========================================================================

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  media_url text not null
    check (media_url ~ '^https://' and char_length(media_url) <= 2048),
  media_type text not null check (media_type in ('image', 'video')),
  studio text not null default '' check (char_length(studio) <= 80),
  platforms text[] not null
    check (cardinality(platforms) between 1 and 6),
  caption text not null default '' check (char_length(caption) <= 5000),
  hashtags text[] not null default '{}' check (cardinality(hashtags) <= 30),
  scheduled_for timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'draft', 'posted', 'failed')),
  created_at timestamptz not null default now(),
  -- a scheduled post needs a time; a draft does not
  check (status <> 'scheduled' or scheduled_for is not null)
);

create index if not exists scheduled_posts_owner_idx
  on public.scheduled_posts (clerk_user_id, scheduled_for);

alter table public.scheduled_posts enable row level security;

drop policy if exists "Owners read own scheduled posts" on public.scheduled_posts;
drop policy if exists "Owners insert own scheduled posts" on public.scheduled_posts;
drop policy if exists "Owners update own scheduled posts" on public.scheduled_posts;
drop policy if exists "Owners delete own scheduled posts" on public.scheduled_posts;

create policy "Owners read own scheduled posts"
  on public.scheduled_posts for select to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners insert own scheduled posts"
  on public.scheduled_posts for insert to anon, authenticated
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners update own scheduled posts"
  on public.scheduled_posts for update to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);

create policy "Owners delete own scheduled posts"
  on public.scheduled_posts for delete to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

revoke all on public.scheduled_posts from public, anon, authenticated;
grant select, insert, update, delete on public.scheduled_posts to anon, authenticated;
