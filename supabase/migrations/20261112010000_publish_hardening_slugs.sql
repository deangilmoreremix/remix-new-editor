-- ===========================================================================
-- publish_hardening_slugs.sql
--
-- 1. Readable, owner-controlled URLs:  /v/<business>/<video-slug>
--    - video_owner_profiles: one unique business namespace per owner
--    - published_videos.slug (unique per owner), privacy, revision
--    - video_slug_redirects: old URLs keep working after a rename
--    - claim_business_slug / set_video_slug RPCs (validation, reserved words,
--      ownership, collisions) — API roles can NOT write slugs directly.
-- 2. Immutable published revisions (published_video_revisions).
-- 3. Security fixes to the existing publish stack:
--    - public enumeration of published_videos removed; the public player reads
--      through get_published_video(), which strips webhook URLs / notification
--      e-mails / owner id from the project JSON.
--    - updated_at no longer bumps on every view; revision bumps on content change.
--    - views counted once (record_video_event('view') bumps view_count).
--    - tightened grants / search_path on the events and rate-limit objects.
-- ===========================================================================

-- ---------------------------------------------------------------- slugs
create or replace function public.slug_is_valid(s text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select s is not null
     and s ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$'
     and s !~ '--'
     and s <> all (array[
       'admin','api','app','assets','auth','billing','account','profile','dashboard','embed',
       'help','login','logout','new','null','undefined','settings','signin','signup','static',
       'support','v','watch','www','openthorn','netlify','supabase','smartvideo','smartvid',
       'official','root','system','video','videos','edit','preview','public','private'
     ]);
$$;

create table if not exists public.video_owner_profiles (
  clerk_user_id text primary key default (auth.jwt() ->> 'sub'),
  business_slug text not null unique
    check (public.slug_is_valid(business_slug)),
  display_name text check (display_name is null or char_length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.video_owner_profiles enable row level security;
drop policy if exists "Owners read own profile" on public.video_owner_profiles;
create policy "Owners read own profile"
  on public.video_owner_profiles for select to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);
revoke all on public.video_owner_profiles from anon, authenticated;
grant select on public.video_owner_profiles to anon, authenticated; -- RLS limits to own row

alter table public.published_videos add column if not exists slug text;
alter table public.published_videos add column if not exists privacy text not null default 'public';
alter table public.published_videos add column if not exists revision integer not null default 1;

alter table public.published_videos drop constraint if exists published_videos_slug_valid;
alter table public.published_videos
  add constraint published_videos_slug_valid check (slug is null or public.slug_is_valid(slug));
alter table public.published_videos drop constraint if exists published_videos_privacy_valid;
alter table public.published_videos
  add constraint published_videos_privacy_valid check (privacy in ('public', 'unlisted'));

-- A business namespace is owned by exactly one owner, so (owner, slug) unique
-- is equivalent to (business, slug) unique.
create unique index if not exists published_videos_owner_slug_uidx
  on public.published_videos (clerk_user_id, slug) where slug is not null;

create table if not exists public.video_slug_redirects (
  business_slug text not null,
  old_slug text not null,
  video_id text not null references public.published_videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (business_slug, old_slug)
);
alter table public.video_slug_redirects enable row level security;
revoke all on public.video_slug_redirects from anon, authenticated; -- definer functions only

-- ---------------------------------------------------------------- revisions
create table if not exists public.published_video_revisions (
  video_id text not null references public.published_videos (id) on delete cascade,
  revision integer not null,
  title text not null,
  project jsonb not null,
  created_at timestamptz not null default now(),
  primary key (video_id, revision)
);
alter table public.published_video_revisions enable row level security;
drop policy if exists "Owners read own revisions" on public.published_video_revisions;
create policy "Owners read own revisions"
  on public.published_video_revisions for select to anon, authenticated
  using (exists (
    select 1 from public.published_videos v
    where v.id = published_video_revisions.video_id
      and v.clerk_user_id = (select auth.jwt() ->> 'sub')));
revoke all on public.published_video_revisions from anon, authenticated;
grant select on public.published_video_revisions to anon, authenticated;

-- ---------------------------------------------------------------- guard trigger
create or replace function public.published_videos_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  api boolean := current_user in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if api then
      new.view_count := 0;
      new.slug := null;       -- slugs are only set through set_video_slug()
      new.revision := 1;
    end if;
    new.updated_at := now();
    return new;
  end if;

  if api then
    new.view_count := old.view_count;
    new.created_at := old.created_at;
    new.clerk_user_id := old.clerk_user_id;
    new.slug := old.slug;
  end if;
  new.revision := case when new.project is distinct from old.project then old.revision + 1 else old.revision end;
  -- Counter-only updates (views) must not look like an edit.
  if (new.project, new.title, new.published, new.privacy, new.slug)
       is distinct from (old.project, old.title, old.published, old.privacy, old.slug) then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create or replace function public.published_videos_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.revision is distinct from old.revision then
    insert into public.published_video_revisions (video_id, revision, title, project)
    values (new.id, new.revision, new.title, new.project)
    on conflict do nothing;
    delete from public.published_video_revisions r
     where r.video_id = new.id and r.revision <= new.revision - 20;
  end if;
  return null;
end;
$$;
revoke all on function public.published_videos_snapshot() from public;

drop trigger if exists published_videos_snapshot on public.published_videos;
create trigger published_videos_snapshot
  after insert or update on public.published_videos
  for each row execute function public.published_videos_snapshot();

-- Backfill: every existing video gets its current content as a revision.
insert into public.published_video_revisions (video_id, revision, title, project)
select id, revision, title, project from public.published_videos
on conflict do nothing;

-- ---------------------------------------------------------------- slug RPCs
create or replace function public.claim_business_slug(p_slug text, p_display text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := auth.jwt() ->> 'sub';
  s text := lower(btrim(coalesce(p_slug, '')));
  prev text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.slug_is_valid(s) then raise exception 'invalid_slug' using errcode = '22023'; end if;

  select business_slug into prev from public.video_owner_profiles where clerk_user_id = me;
  if prev = s then
    update public.video_owner_profiles
       set display_name = coalesce(p_display, display_name), updated_at = now()
     where clerk_user_id = me;
    return s;
  end if;

  -- A namespace that was released (it still has redirects) is never handed to
  -- a different owner: that would let them inherit or hijack the old links.
  if exists (
    select 1 from public.video_slug_redirects r
    join public.published_videos v on v.id = r.video_id
    where r.business_slug = s and v.clerk_user_id <> me
  ) then
    raise exception 'slug_taken' using errcode = '23505';
  end if;

  begin
    insert into public.video_owner_profiles (clerk_user_id, business_slug, display_name)
    values (me, s, p_display)
    on conflict (clerk_user_id) do update
      set business_slug = excluded.business_slug,
          display_name = coalesce(excluded.display_name, public.video_owner_profiles.display_name),
          updated_at = now();
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = '23505';
  end;

  -- Keep every existing URL working under the old namespace.
  if prev is not null then
    insert into public.video_slug_redirects (business_slug, old_slug, video_id)
    select prev, v.slug, v.id from public.published_videos v
     where v.clerk_user_id = me and v.slug is not null
    on conflict (business_slug, old_slug) do update set video_id = excluded.video_id;
  end if;
  return s;
end;
$$;

create or replace function public.set_video_slug(p_video_id text, p_slug text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := auth.jwt() ->> 'sub';
  s text := lower(btrim(coalesce(p_slug, '')));
  biz text;
  prev text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select v.slug into prev from public.published_videos v
   where v.id = p_video_id and v.clerk_user_id = me;
  if not found then raise exception 'not_found' using errcode = '42501'; end if;

  select business_slug into biz from public.video_owner_profiles where clerk_user_id = me;
  if biz is null then raise exception 'business_required' using errcode = '22023'; end if;
  if not public.slug_is_valid(s) then raise exception 'invalid_slug' using errcode = '22023'; end if;
  if prev = s then return s; end if;

  -- Re-using one of your own old slugs is fine: drop that redirect.
  delete from public.video_slug_redirects where business_slug = biz and old_slug = s;
  begin
    update public.published_videos set slug = s where id = p_video_id;
  exception when unique_violation then
    raise exception 'slug_taken' using errcode = '23505';
  end;
  if prev is not null then
    insert into public.video_slug_redirects (business_slug, old_slug, video_id)
    values (biz, prev, p_video_id)
    on conflict (business_slug, old_slug) do update set video_id = excluded.video_id;
  end if;
  return s;
end;
$$;

revoke all on function public.claim_business_slug(text, text) from public;
revoke all on function public.set_video_slug(text, text) from public;
grant execute on function public.claim_business_slug(text, text) to authenticated, anon;
grant execute on function public.set_video_slug(text, text) to authenticated, anon;

-- ---------------------------------------------------------------- public read
-- Remove private fields (webhooks, notification e-mails) from a project JSON.
create or replace function public.strip_private_keys(j jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  el jsonb;
  out jsonb;
begin
  if jsonb_typeof(j) = 'object' then
    out := '{}'::jsonb;
    for k, el in select * from jsonb_each(j) loop
      if k ~* '^(webhook.*|notificationEmail|notifyEmail|callNotifyAddress|notifyAddress)$' then
        continue;
      end if;
      out := out || jsonb_build_object(k, public.strip_private_keys(el));
    end loop;
    return out;
  elsif jsonb_typeof(j) = 'array' then
    select coalesce(jsonb_agg(public.strip_private_keys(e.value) order by e.ord), '[]'::jsonb)
      into out from jsonb_array_elements(j) with ordinality as e(value, ord);
    return out;
  end if;
  return j;
end;
$$;
revoke all on function public.strip_private_keys(jsonb) from public;

-- The ONLY public read path. Lookup by id (/watch/<id>) or by business + slug
-- (/v/<business>/<slug>); a renamed slug answers with a redirect. Returns null
-- for unknown or unpublished videos; never returns owner ids or webhooks.
create or replace function public.get_published_video(
  p_id text default null,
  p_business text default null,
  p_slug text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.published_videos;
  biz text;
  rid text;
begin
  if p_id is not null then
    select * into v from public.published_videos where id = p_id and published = true;
  else
    select pv.* into v
      from public.published_videos pv
      join public.video_owner_profiles o on o.clerk_user_id = pv.clerk_user_id
     where o.business_slug = lower(p_business) and pv.slug = lower(p_slug) and pv.published = true;
    if not found then
      select r.video_id into rid
        from public.video_slug_redirects r
        join public.published_videos pv on pv.id = r.video_id and pv.published = true
       where r.business_slug = lower(p_business) and r.old_slug = lower(p_slug);
      if rid is not null then
        select * into v from public.published_videos where id = rid;
        select o.business_slug into biz from public.video_owner_profiles o where o.clerk_user_id = v.clerk_user_id;
        return jsonb_build_object('redirect', jsonb_build_object('id', v.id, 'business', biz, 'slug', v.slug));
      end if;
      return null;
    end if;
  end if;
  if v.id is null then return null; end if;

  select o.business_slug into biz from public.video_owner_profiles o where o.clerk_user_id = v.clerk_user_id;
  return jsonb_build_object(
    'id', v.id,
    'title', v.title,
    'project', public.strip_private_keys(v.project),
    'updated_at', v.updated_at,
    'revision', v.revision,
    'privacy', v.privacy,
    'slug', v.slug,
    'business', biz
  );
end;
$$;
revoke all on function public.get_published_video(text, text, text) from public;
grant execute on function public.get_published_video(text, text, text) to anon, authenticated;

-- Public listing/enumeration is gone; owners still read their own rows.
drop policy if exists "Anyone reads published videos" on public.published_videos;

-- ---------------------------------------------------------------- views
-- One source of truth: a 'view' event bumps view_count (the player no longer
-- calls increment_video_view as well).
create or replace function public.record_video_event(
  video_id text,
  kind text,
  contact_id text default null,
  clip_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if kind not in ('view', 'play', 'complete', 'cta_click', 'lead') then
    return;
  end if;
  if contact_id is not null and contact_id !~ '^[A-Za-z0-9_-]{1,80}$' then
    contact_id := null;
  end if;
  if clip_id is not null and char_length(clip_id) > 80 then
    clip_id := null;
  end if;
  insert into public.published_video_events (video_id, contact_id, kind, clip_id)
  select v.id, record_video_event.contact_id, record_video_event.kind, record_video_event.clip_id
    from public.published_videos v
   where v.id = record_video_event.video_id
     and v.published = true;
  if kind = 'view' then
    update public.published_videos v set view_count = v.view_count + 1
     where v.id = record_video_event.video_id and v.published = true;
  end if;
end;
$$;

-- ---------------------------------------------------------------- grants
do $$
begin
  if to_regclass('public.published_video_events') is not null then
    execute 'revoke truncate, references, trigger on public.published_video_events from anon, authenticated';
  end if;
  if to_regclass('public.rate_limits') is not null then
    execute 'revoke all on public.rate_limits from anon, authenticated';
  end if;
  if to_regprocedure('public.rate_limit_check(text,text,integer,integer)') is not null then
    execute 'alter function public.rate_limit_check(text,text,integer,integer) set search_path = ''''';
    execute 'revoke all on function public.rate_limit_check(text,text,integer,integer) from public, anon, authenticated';
    execute 'grant execute on function public.rate_limit_check(text,text,integer,integer) to service_role';
  end if;
  if to_regprocedure('public.rate_limit_cleanup(integer)') is not null then
    execute 'alter function public.rate_limit_cleanup(integer) set search_path = ''''';
    execute 'revoke all on function public.rate_limit_cleanup(integer) from public, anon, authenticated';
    execute 'grant execute on function public.rate_limit_cleanup(integer) to service_role';
  end if;
end $$;
