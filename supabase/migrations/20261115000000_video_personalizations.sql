-- ===========================================================================
-- video_personalizations.sql
--
-- Personal links for published videos: /watch/<id>?p=<link id>.
--
-- A row holds the details ONE recipient's copy of the video is filled with
-- (token values such as firstname / businessName / logoUrl, their brand colors
-- and image crop settings), so the link carries only an unguessable id. That
-- removes the URL-length limit, and a link can no longer be edited by hand to
-- pose as another contact (the old ?c=...&token=... form still works as a
-- fallback in the app).
--
--   id            the link id (16-32 URL-safe chars, generated client-side)
--   video_id      the published video it opens
--   contact_id    the Personalization Studio contact it belongs to (optional);
--                 one link per contact per video
--   variables     values synced from the contact
--   overrides     values the owner typed for this link; they win over
--                 `variables` and survive a re-sync
--   revoked       true = the link stops working (the id stays reserved)
--
-- The owner changes a link by editing `overrides`/`name`, revoking it, or
-- giving it a new id (update ... set id = <new>): the old URL then stops
-- working. Viewers read a link only through get_personalization(); the table is
-- never publicly readable.
-- ===========================================================================

create table if not exists public.video_personalizations (
  id text primary key
    check (id ~ '^[A-Za-z0-9_-]{16,32}$'),
  video_id text not null references public.published_videos (id) on delete cascade,
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  contact_id text
    check (contact_id is null or contact_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  name text not null default ''
    check (char_length(name) <= 120),
  variables jsonb not null default '{}'::jsonb,
  overrides jsonb not null default '{}'::jsonb,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_personalizations_variables_object check (jsonb_typeof(variables) = 'object'),
  constraint video_personalizations_overrides_object check (jsonb_typeof(overrides) = 'object'),
  constraint video_personalizations_variables_size check (pg_column_size(variables) < 32768),
  constraint video_personalizations_overrides_size check (pg_column_size(overrides) < 32768),
  constraint video_personalizations_one_per_contact unique (video_id, contact_id)
);

create index if not exists video_personalizations_owner_idx
  on public.video_personalizations (clerk_user_id, video_id, created_at desc);

create or replace function public.video_personalizations_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A trigger helper, not an API: keep it out of the public RPC surface.
revoke all on function public.video_personalizations_touch() from public, anon, authenticated;

drop trigger if exists video_personalizations_touch on public.video_personalizations;
create trigger video_personalizations_touch
  before update on public.video_personalizations
  for each row execute function public.video_personalizations_touch();

alter table public.video_personalizations enable row level security;

drop policy if exists "Owners read own personalizations" on public.video_personalizations;
drop policy if exists "Owners insert own personalizations" on public.video_personalizations;
drop policy if exists "Owners update own personalizations" on public.video_personalizations;
drop policy if exists "Owners delete own personalizations" on public.video_personalizations;

create policy "Owners read own personalizations"
  on public.video_personalizations
  for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- A link can only be attached to a video its owner owns.
create policy "Owners insert own personalizations"
  on public.video_personalizations
  for insert
  to authenticated
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (
      select 1 from public.published_videos v
       where v.id = video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

create policy "Owners update own personalizations"
  on public.video_personalizations
  for update
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (
      select 1 from public.published_videos v
       where v.id = video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub')
    )
  );

create policy "Owners delete own personalizations"
  on public.video_personalizations
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

revoke all on public.video_personalizations from anon;
grant select, insert, update, delete on public.video_personalizations to authenticated;

-- The ONLY public read path: the values for one link, or null when the link is
-- unknown, revoked, or its video is not published. Never returns the owner id,
-- the contact's display name, or other contacts' links.
create or replace function public.get_personalization(p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.video_personalizations;
begin
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{16,32}$' then
    return null;
  end if;
  select p.* into r
    from public.video_personalizations p
    join public.published_videos v on v.id = p.video_id and v.published = true
   where p.id = p_id and p.revoked = false;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'videoId', r.video_id,
    'contactId', r.contact_id,
    'variables', r.variables || r.overrides
  );
end;
$$;
revoke all on function public.get_personalization(text) from public;
grant execute on function public.get_personalization(text) to anon, authenticated;

comment on table public.video_personalizations is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: personal links for published videos (the details one recipient''s copy is filled with).';
comment on function public.get_personalization(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_personalizations_touch() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
