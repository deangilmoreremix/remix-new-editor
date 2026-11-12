-- Minimal replica of the LIVE publishing schema (project bzxohkrxcwodllketcpz), rebuilt from the table,
-- constraint, policy, grant and function definitions read from the database. Used only to test new
-- migrations on top of it; it is not a migration and must never be applied to a real project.
create table public.timeline_projects (id uuid primary key default gen_random_uuid(), clerk_user_id text not null);

create or replace function public.slug_is_valid(s text) returns boolean language sql immutable set search_path = '' as $$
  select s is not null and s ~ '^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$' and s !~ '--'
     and s <> all (array['admin','api','app','assets','auth','billing','account','profile','dashboard','embed','help','login','logout','new','null','undefined','settings','signin','signup','static','support','v','watch','www','openthorn','netlify','supabase','smartvideo','smartvid','official','root','system','video','videos','edit','preview','public','private']);
$$;

create or replace function public.strip_private_keys(j jsonb) returns jsonb language plpgsql immutable set search_path = '' as $$
declare k text; el jsonb; out jsonb;
begin
  if jsonb_typeof(j) = 'object' then
    out := '{}'::jsonb;
    for k, el in select * from jsonb_each(j) loop
      if k ~* '^(webhook.*|notificationEmail|notifyEmail|callNotifyAddress|notifyAddress)$' then continue; end if;
      out := out || jsonb_build_object(k, public.strip_private_keys(el));
    end loop;
    return out;
  elsif jsonb_typeof(j) = 'array' then
    select coalesce(jsonb_agg(public.strip_private_keys(e.value) order by e.ord), '[]'::jsonb) into out from jsonb_array_elements(j) with ordinality as e(value, ord);
    return out;
  end if;
  return j;
end; $$;

create table public.published_videos (
  id text primary key constraint published_videos_id_check check (id ~ '^[A-Za-z0-9_-]{8,32}$'),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  title text not null default 'Untitled video' constraint published_videos_title_check check (char_length(title) <= 200),
  project jsonb not null,
  published boolean not null default true,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  project_id uuid,
  slug text,
  privacy text not null default 'public',
  revision integer not null default 1,
  constraint published_videos_privacy_valid check (privacy = any (array['public','unlisted'])),
  constraint published_videos_project_is_object check (jsonb_typeof(project) = 'object'),
  constraint published_videos_project_size check (pg_column_size(project) < 2097152),
  constraint published_videos_slug_valid check (slug is null or public.slug_is_valid(slug))
);
create index published_videos_owner_idx on public.published_videos (clerk_user_id, updated_at desc);
create unique index published_videos_owner_slug_uidx on public.published_videos (clerk_user_id, slug) where slug is not null;

create table public.published_video_revisions (
  video_id text not null references public.published_videos (id) on delete cascade,
  revision integer not null, title text not null, project jsonb not null, created_at timestamptz not null default now(),
  primary key (video_id, revision)
);
create table public.video_owner_profiles (
  clerk_user_id text primary key default (auth.jwt() ->> 'sub'), business_slug text not null unique check (public.slug_is_valid(business_slug)),
  display_name text check (display_name is null or char_length(display_name) <= 120),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.video_slug_redirects (
  business_slug text not null, old_slug text not null, video_id text not null references public.published_videos (id) on delete cascade,
  created_at timestamptz not null default now(), primary key (business_slug, old_slug)
);

create or replace function public.published_videos_check_project() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.project_id is not null and not exists (select 1 from public.timeline_projects p where p.id = new.project_id and p.clerk_user_id = new.clerk_user_id) then
    raise exception 'project_id does not belong to the video owner' using errcode = '42501';
  end if;
  return new;
end; $$;

create or replace function public.published_videos_guard() returns trigger language plpgsql set search_path = '' as $$
declare api boolean := current_user in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    if api then new.view_count := 0; new.slug := null; new.revision := 1; end if;
    new.updated_at := now(); return new;
  end if;
  if api then new.view_count := old.view_count; new.created_at := old.created_at; new.clerk_user_id := old.clerk_user_id; new.slug := old.slug; end if;
  new.revision := case when new.project is distinct from old.project then old.revision + 1 else old.revision end;
  if (new.project, new.title, new.published, new.privacy, new.slug) is distinct from (old.project, old.title, old.published, old.privacy, old.slug) then new.updated_at := now(); else new.updated_at := old.updated_at; end if;
  return new;
end; $$;

create or replace function public.published_videos_snapshot() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.revision is distinct from old.revision then
    insert into public.published_video_revisions (video_id, revision, title, project) values (new.id, new.revision, new.title, new.project) on conflict do nothing;
    delete from public.published_video_revisions r where r.video_id = new.id and r.revision <= new.revision - 20;
  end if;
  return null;
end; $$;

create trigger published_videos_check_project before insert or update on public.published_videos for each row execute function public.published_videos_check_project();
create trigger published_videos_guard before insert or update on public.published_videos for each row execute function public.published_videos_guard();
create trigger published_videos_snapshot after insert or update on public.published_videos for each row execute function public.published_videos_snapshot();

create or replace function public.claim_business_slug(p_slug text, p_display text default null) returns text language plpgsql security definer set search_path = '' as $$
declare me text := auth.jwt() ->> 'sub'; s text := lower(btrim(coalesce(p_slug, ''))); prev text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not public.slug_is_valid(s) then raise exception 'invalid_slug' using errcode = '22023'; end if;
  select business_slug into prev from public.video_owner_profiles where clerk_user_id = me;
  if prev = s then update public.video_owner_profiles set display_name = coalesce(p_display, display_name), updated_at = now() where clerk_user_id = me; return s; end if;
  if exists (select 1 from public.video_slug_redirects r join public.published_videos v on v.id = r.video_id where r.business_slug = s and v.clerk_user_id <> me) then raise exception 'slug_taken' using errcode = '23505'; end if;
  begin
    insert into public.video_owner_profiles (clerk_user_id, business_slug, display_name) values (me, s, p_display)
    on conflict (clerk_user_id) do update set business_slug = excluded.business_slug, display_name = coalesce(excluded.display_name, public.video_owner_profiles.display_name), updated_at = now();
  exception when unique_violation then raise exception 'slug_taken' using errcode = '23505'; end;
  if prev is not null then
    insert into public.video_slug_redirects (business_slug, old_slug, video_id) select prev, v.slug, v.id from public.published_videos v where v.clerk_user_id = me and v.slug is not null
    on conflict (business_slug, old_slug) do update set video_id = excluded.video_id;
  end if;
  return s;
end; $$;

create or replace function public.set_video_slug(p_video_id text, p_slug text) returns text language plpgsql security definer set search_path = '' as $$
declare me text := auth.jwt() ->> 'sub'; s text := lower(btrim(coalesce(p_slug, ''))); biz text; prev text;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select v.slug into prev from public.published_videos v where v.id = p_video_id and v.clerk_user_id = me;
  if not found then raise exception 'not_found' using errcode = '42501'; end if;
  select business_slug into biz from public.video_owner_profiles where clerk_user_id = me;
  if biz is null then raise exception 'business_required' using errcode = '22023'; end if;
  if not public.slug_is_valid(s) then raise exception 'invalid_slug' using errcode = '22023'; end if;
  if prev = s then return s; end if;
  delete from public.video_slug_redirects where business_slug = biz and old_slug = s;
  begin update public.published_videos set slug = s where id = p_video_id; exception when unique_violation then raise exception 'slug_taken' using errcode = '23505'; end;
  if prev is not null then
    insert into public.video_slug_redirects (business_slug, old_slug, video_id) values (biz, prev, p_video_id) on conflict (business_slug, old_slug) do update set video_id = excluded.video_id;
  end if;
  return s;
end; $$;

create or replace function public.get_published_video(p_id text default null, p_business text default null, p_slug text default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v public.published_videos; biz text; rid text;
begin
  if p_id is not null then select * into v from public.published_videos where id = p_id and published = true;
  else
    select pv.* into v from public.published_videos pv join public.video_owner_profiles o on o.clerk_user_id = pv.clerk_user_id where o.business_slug = lower(p_business) and pv.slug = lower(p_slug) and pv.published = true;
    if not found then
      select r.video_id into rid from public.video_slug_redirects r join public.published_videos pv on pv.id = r.video_id and pv.published = true where r.business_slug = lower(p_business) and r.old_slug = lower(p_slug);
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
  return jsonb_build_object('id', v.id, 'title', v.title, 'project', public.strip_private_keys(v.project), 'updated_at', v.updated_at, 'revision', v.revision, 'privacy', v.privacy, 'slug', v.slug, 'business', biz);
end; $$;

alter table public.published_videos enable row level security;
alter table public.published_video_revisions enable row level security;
alter table public.video_owner_profiles enable row level security;
alter table public.video_slug_redirects enable row level security;
create policy "Anyone reads published videos" on public.published_videos for select to anon, authenticated using (published = true);
create policy "Owners read own videos" on public.published_videos for select to anon, authenticated using ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Owners insert own videos" on public.published_videos for insert to anon, authenticated with check ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Owners update own videos" on public.published_videos for update to anon, authenticated using ((select auth.jwt() ->> 'sub') = clerk_user_id) with check ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Owners delete own videos" on public.published_videos for delete to anon, authenticated using ((select auth.jwt() ->> 'sub') = clerk_user_id);
create policy "Owners read own revisions" on public.published_video_revisions for select to anon, authenticated using (exists (select 1 from public.published_videos v where v.id = published_video_revisions.video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub')));
create policy "Owners read own profile" on public.video_owner_profiles for select to anon, authenticated using ((select auth.jwt() ->> 'sub') = clerk_user_id);

revoke all on public.published_videos, public.published_video_revisions, public.video_owner_profiles, public.video_slug_redirects from anon, authenticated;
grant select, insert, update, delete on public.published_videos to anon, authenticated;
grant select on public.published_video_revisions, public.video_owner_profiles to anon, authenticated;
grant execute on function public.get_published_video(text, text, text), public.set_video_slug(text, text), public.claim_business_slug(text, text) to anon, authenticated;
