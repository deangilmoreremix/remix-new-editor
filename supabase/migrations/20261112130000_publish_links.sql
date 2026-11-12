-- ===========================================================================
-- publish_links.sql  (additive; existing /watch/<id> links keep working)
--
--  * published_videos.slug        readable public URL key (/v/<slug>); nullable,
--                                 `id` stays the permanent internal identifier.
--  * published_video_slug_aliases old slugs keep resolving after a rename.
--  * published_video_revisions    draft / live history. published_videos.project
--                                 stays the LIVE snapshot, so existing readers
--                                 (player, lead-capture, watch-voice) are unchanged.
--  * video_recipients             opaque per-recipient tokens + the variables
--                                 (text + image URLs) shown to that recipient.
--  * get_published_video(key)     public single-row read by id/slug/alias.
--  * resolve_recipient(id, token) public: returns ONLY that recipient's variables.
-- ===========================================================================

alter table public.published_videos
  add column if not exists slug text,
  add column if not exists live_revision integer not null default 1,
  add column if not exists business_id uuid;

alter table public.published_videos drop constraint if exists published_videos_slug_format;
alter table public.published_videos add constraint published_videos_slug_format
  check (
    slug is null or (
      slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'
      and slug not in ('watch','v','api','admin','embed','login','signup','app','static','assets','www','null','undefined')
    )
  );

create unique index if not exists published_videos_slug_uidx
  on public.published_videos (lower(slug)) where slug is not null;

-- ---------------------------------------------------------------- aliases
create table if not exists public.published_video_slug_aliases (
  old_slug text primary key check (old_slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  video_id text not null references public.published_videos (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.published_video_slug_aliases enable row level security;
revoke all on public.published_video_slug_aliases from anon, authenticated;
-- written only by the trigger below; read only through get_published_video().

create or replace function public.published_videos_slug_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.slug is not null and new.slug is distinct from old.slug then
    insert into public.published_video_slug_aliases (old_slug, video_id)
    values (old.slug, old.id) on conflict (old_slug) do nothing;
  end if;
  if new.slug is not null then
    -- a slug must not collide with another video's alias
    if exists (select 1 from public.published_video_slug_aliases a
                where a.old_slug = lower(new.slug) and a.video_id <> new.id) then
      raise exception 'slug_taken' using errcode = '23505';
    end if;
    -- taking a slug back removes this video's own alias for it
    delete from public.published_video_slug_aliases where old_slug = lower(new.slug) and video_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists published_videos_slug_guard on public.published_videos;
create trigger published_videos_slug_guard
  before insert or update of slug on public.published_videos
  for each row execute function public.published_videos_slug_guard();

-- --------------------------------------------------------------- revisions
create table if not exists public.published_video_revisions (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.published_videos (id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  revision integer not null check (revision >= 1),
  kind text not null default 'draft' check (kind in ('draft', 'live', 'superseded')),
  project jsonb not null check (jsonb_typeof(project) = 'object' and pg_column_size(project) < 2097152),
  created_at timestamptz not null default now(),
  unique (video_id, revision)
);
alter table public.published_video_revisions enable row level security;
drop policy if exists "revisions_owner_all" on public.published_video_revisions;
create policy "revisions_owner_all" on public.published_video_revisions
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (select 1 from public.published_videos v
                where v.id = video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );
revoke all on public.published_video_revisions from anon;
revoke truncate, references, trigger on public.published_video_revisions from authenticated;
grant select, insert, update, delete on public.published_video_revisions to authenticated;

-- Promote a draft revision to live. SECURITY INVOKER: RLS enforces ownership,
-- and the live row keeps the same id/slug, so every existing link and every
-- recipient token keeps working.
create or replace function public.promote_video_revision(p_video_id text, p_revision integer)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project jsonb;
begin
  select project into v_project
    from public.published_video_revisions
   where video_id = p_video_id and revision = p_revision and kind = 'draft';
  if v_project is null then
    raise exception 'draft_not_found' using errcode = 'P0002';
  end if;

  update public.published_videos
     set project = v_project, live_revision = p_revision, published = true
   where id = p_video_id;
  if not found then
    raise exception 'not_owner_or_missing' using errcode = '42501';
  end if;

  update public.published_video_revisions set kind = 'superseded'
   where video_id = p_video_id and kind = 'live';
  update public.published_video_revisions set kind = 'live'
   where video_id = p_video_id and revision = p_revision;
  return p_revision;
end;
$$;
revoke all on function public.promote_video_revision(text, integer) from public, anon;
grant execute on function public.promote_video_revision(text, integer) to authenticated;

-- -------------------------------------------------------------- recipients
create table if not exists public.video_recipients (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.published_videos (id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  -- opaque, unguessable: two v4 UUIDs (~244 random bits), no PII, no counter
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  label text check (label is null or char_length(label) <= 200),   -- owner-facing only, never sent to viewers
  business_id uuid,
  variables jsonb not null default '{}'::jsonb
    check (jsonb_typeof(variables) = 'object' and pg_column_size(variables) < 16384),
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists video_recipients_video_idx on public.video_recipients (video_id, created_at desc);

alter table public.video_recipients enable row level security;
drop policy if exists "recipients_owner_all" on public.video_recipients;
create policy "recipients_owner_all" on public.video_recipients
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (select 1 from public.published_videos v
                where v.id = video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );
revoke all on public.video_recipients from anon;
revoke truncate, references, trigger on public.video_recipients from authenticated;
grant select, insert, update, delete on public.video_recipients to authenticated;

create or replace function public.video_recipients_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user in ('anon', 'authenticated') then
    new.token := old.token;            -- tokens are never re-assigned
    new.video_id := old.video_id;
    new.clerk_user_id := old.clerk_user_id;
    if new.status = 'revoked' and old.status <> 'revoked' then new.revoked_at := now(); end if;
    if old.status = 'revoked' then new.status := 'revoked'; new.revoked_at := old.revoked_at; end if;  -- revocation is permanent
  end if;
  return new;
end;
$$;
drop trigger if exists video_recipients_guard on public.video_recipients;
create trigger video_recipients_guard before update on public.video_recipients
  for each row execute function public.video_recipients_guard();

-- ----------------------------------------------------------- public reads
-- Single-row public read by id, slug or an old (aliased) slug. Returns only
-- what the player needs; the table itself stays owner-only for new columns.
create or replace function public.get_published_video(p_key text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'id', v.id, 'slug', v.slug, 'title', v.title, 'project', v.project,
           'revision', v.live_revision, 'canonical', coalesce(v.slug, v.id))
    from public.published_videos v
   where v.published = true
     and (v.id = p_key
          or lower(v.slug) = lower(p_key)
          or v.id = (select a.video_id from public.published_video_slug_aliases a where a.old_slug = lower(p_key)))
   limit 1;
$$;
revoke all on function public.get_published_video(text) from public;
grant execute on function public.get_published_video(text) to anon, authenticated;

-- Resolves one recipient token to that recipient's variables. Returns NULL for
-- unknown, revoked or expired tokens and for unpublished videos, so a probe
-- learns nothing. Never returns label/business_id or any other recipient's data.
create or replace function public.resolve_recipient(p_video_id text, p_token text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select r.variables
    from public.video_recipients r
    join public.published_videos v on v.id = r.video_id
   where r.token = p_token
     and r.video_id = (select vv.id from public.published_videos vv
                        where vv.id = p_video_id or lower(vv.slug) = lower(p_video_id)
                           or vv.id = (select a.video_id from public.published_video_slug_aliases a where a.old_slug = lower(p_video_id))
                        limit 1)
     and r.status = 'active'
     and (r.expires_at is null or r.expires_at > now())
     and v.published = true
   limit 1;
$$;
revoke all on function public.resolve_recipient(text, text) from public;
grant execute on function public.resolve_recipient(text, text) to anon, authenticated;
