-- ===========================================================================
-- recipients_and_drafts.sql  (additive; builds on the LIVE publishing schema)
--
-- The live project already has: published_videos (slug, privacy, revision),
-- video_owner_profiles (business slug), video_slug_redirects, and
-- published_video_revisions (an immutable snapshot written by trigger on every
-- project change). This migration adds only what is missing and changes none
-- of those objects:
--
--   video_recipients       opaque per-recipient tokens + the variables (text and
--                          image URLs) that recipient sees; revocable.
--   resolve_recipient()    anon-callable: returns ONLY that recipient's variables.
--   published_video_drafts owner-only drafts. Promoting a draft is an owner UPDATE
--                          of published_videos.project/title, so the live snapshot
--                          trigger records the new revision (history + rollback).
--   promote_video_draft()  SECURITY INVOKER: RLS decides who may promote.
--
-- Depends on: 20261112120000_business_asset_library.sql (business_profiles).
-- ===========================================================================

create table if not exists public.video_recipients (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.published_videos (id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  -- opaque and unguessable: two v4 UUIDs (~244 random bits); no PII, no counter
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  label text check (label is null or char_length(label) <= 200),          -- owner-facing only
  business_id uuid references public.business_profiles (id) on delete set null,
  contact_ref text check (contact_ref is null or contact_ref ~ '^[A-Za-z0-9_-]{1,80}$'),  -- owner-facing only
  variables jsonb not null default '{}'::jsonb
    check (jsonb_typeof(variables) = 'object' and pg_column_size(variables) < 16384),
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists video_recipients_video_idx on public.video_recipients (video_id, created_at desc);
-- one ACTIVE link per contact per video (revoking frees the contact up)
create unique index if not exists video_recipients_active_contact_uidx
  on public.video_recipients (video_id, contact_ref) where status = 'active' and contact_ref is not null;

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
    new.token := old.token;             -- tokens are never re-assigned
    new.video_id := old.video_id;
    new.clerk_user_id := old.clerk_user_id;
    if new.status = 'revoked' and old.status <> 'revoked' then new.revoked_at := now(); end if;
    if old.status = 'revoked' then new.status := 'revoked'; new.revoked_at := old.revoked_at; end if;  -- permanent
  end if;
  return new;
end;
$$;
drop trigger if exists video_recipients_guard on public.video_recipients;
create trigger video_recipients_guard before update on public.video_recipients
  for each row execute function public.video_recipients_guard();

-- Public: one token -> that recipient's variables. NULL for unknown, revoked or
-- expired tokens, a token of another video, and unpublished videos, so a probe
-- learns nothing. Slugs are resolved to an id by the live get_published_video().
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
   where r.video_id = p_video_id
     and r.token = p_token
     and r.status = 'active'
     and (r.expires_at is null or r.expires_at > now())
     and v.published = true
   limit 1;
$$;
revoke all on function public.resolve_recipient(text, text) from public;
grant execute on function public.resolve_recipient(text, text) to anon, authenticated;

-- ------------------------------------------------------------------ drafts
create table if not exists public.published_video_drafts (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.published_videos (id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  title text not null default 'Untitled video' check (char_length(title) <= 200),
  project jsonb not null check (jsonb_typeof(project) = 'object' and pg_column_size(project) < 2097152),
  created_at timestamptz not null default now()
);
create index if not exists published_video_drafts_video_idx on public.published_video_drafts (video_id, created_at desc);

alter table public.published_video_drafts enable row level security;
drop policy if exists "drafts_owner_all" on public.published_video_drafts;
create policy "drafts_owner_all" on public.published_video_drafts
  for all to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (select 1 from public.published_videos v
                where v.id = video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );
revoke all on public.published_video_drafts from anon;
revoke truncate, references, trigger on public.published_video_drafts from authenticated;
grant select, insert, update, delete on public.published_video_drafts to authenticated;

-- keep the newest 20 drafts per video
create or replace function public.published_video_drafts_prune()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.published_video_drafts d
   where d.video_id = new.video_id
     and d.id in (select id from public.published_video_drafts
                   where video_id = new.video_id order by created_at desc, id offset 20);
  return null;
end;
$$;
drop trigger if exists published_video_drafts_prune on public.published_video_drafts;
create trigger published_video_drafts_prune after insert on public.published_video_drafts
  for each row execute function public.published_video_drafts_prune();

-- Promote a draft to the live video (same id, same slug, same recipient tokens).
-- SECURITY INVOKER: the caller's RLS applies, so only the owner can read the draft
-- and only the owner can update the video. project_id/slug/published are untouched;
-- the live guard bumps `revision` and the live snapshot trigger records it.
create or replace function public.promote_video_draft(p_draft_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  d public.published_video_drafts;
  rev integer;
begin
  select * into d from public.published_video_drafts where id = p_draft_id;
  if not found then raise exception 'draft_not_found' using errcode = 'P0002'; end if;
  update public.published_videos set project = d.project, title = d.title
   where id = d.video_id
   returning revision into rev;
  if not found then raise exception 'not_owner_or_missing' using errcode = '42501'; end if;
  delete from public.published_video_drafts where id = p_draft_id;
  return rev;
end;
$$;
revoke all on function public.promote_video_draft(uuid) from public, anon;
grant execute on function public.promote_video_draft(uuid) to authenticated;
