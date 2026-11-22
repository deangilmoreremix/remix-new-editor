-- ===========================================================================
-- video_recipients.sql
--
-- Per-recipient details for email campaigns. The sender uploads a list
-- (recipient id as their email provider emits it + first name, company, ...)
-- and the email carries only ?c=<recipient id>. The public player asks for
-- that recipient's details by (video id, recipient id), so names stay out of
-- the URL and out of forwarded links.
--
--   save_video_recipients()  owner only; sanitizes, caps and upserts
--   clear_video_recipients() owner only
--   video_recipient_values() public (anon): details of ONE recipient of ONE
--                            published video; never lists, never returns
--                            email / phone / address-like or secret-like keys
--
-- The table itself is not directly writable by API roles (writes go through the
-- sanitizing function), and only the video's owner can read it.
--
-- NOTE: recipient ids are only as unguessable as the sender's provider makes
-- them. Sequential ids (some providers) can be enumerated one at a time, so
-- only name-like details are ever stored or returned. The feature is opt-in.
-- ===========================================================================

create table if not exists public.video_recipients (
  video_id text not null references public.published_videos (id) on delete cascade,
  recipient_id text not null check (recipient_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object' and pg_column_size(details) < 4096),
  created_at timestamptz not null default now(),
  primary key (video_id, recipient_id)
);

alter table public.video_recipients enable row level security;

drop policy if exists "Owners read own recipients" on public.video_recipients;
drop policy if exists "Owners delete own recipients" on public.video_recipients;

create policy "Owners read own recipients"
  on public.video_recipients
  for select
  to anon, authenticated
  using (exists (
    select 1 from public.published_videos v
     where v.id = video_recipients.video_id
       and v.clerk_user_id = (select auth.jwt() ->> 'sub')
  ));

create policy "Owners delete own recipients"
  on public.video_recipients
  for delete
  to anon, authenticated
  using (exists (
    select 1 from public.published_videos v
     where v.id = video_recipients.video_id
       and v.clerk_user_id = (select auth.jwt() ->> 'sub')
  ));

-- Read/delete only: inserts and updates go through save_video_recipients().
revoke all on public.video_recipients from anon, authenticated;
grant select, delete on public.video_recipients to anon, authenticated;

-- Keeps name-like string values under safe keys. Drops anything that looks like contact or secret data.
create or replace function public.sanitize_recipient_details(d jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  out jsonb := '{}'::jsonb;
  k text;
  v jsonb;
  n integer := 0;
  s text;
begin
  if d is null or jsonb_typeof(d) <> 'object' then return out; end if;
  for k, v in select key, value from jsonb_each(d) loop
    exit when n >= 30;
    if k !~ '^[A-Za-z][A-Za-z0-9_]{0,39}$' then continue; end if;
    if k ~* '(mail|phone|tel|mobile|fax|address|ssn|passw|token|secret|card)' then continue; end if;
    if jsonb_typeof(v) = 'string' then s := v #>> '{}';
    elsif jsonb_typeof(v) = 'number' then s := v #>> '{}';
    else continue;
    end if;
    s := left(btrim(s), 200);
    if s = '' then continue; end if;
    out := out || jsonb_build_object(k, s);
    n := n + 1;
  end loop;
  return out;
end;
$$;

create or replace function public.save_video_recipients(
  p_video_id text,
  p_rows jsonb,
  p_replace boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := auth.jwt() ->> 'sub';
  r jsonb;
  rid text;
  det jsonb;
  saved integer := 0;
  total integer;
begin
  if me is null or not exists (
    select 1 from public.published_videos v where v.id = p_video_id and v.clerk_user_id = me
  ) then
    raise exception 'not_found';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'bad_rows'; end if;
  if jsonb_array_length(p_rows) > 2000 then raise exception 'too_many_rows'; end if;

  if p_replace then
    delete from public.video_recipients where video_id = p_video_id;
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    rid := r ->> 'id';
    if rid is null or rid !~ '^[A-Za-z0-9_-]{1,80}$' then continue; end if;
    det := public.sanitize_recipient_details(r -> 'details');
    if det = '{}'::jsonb then continue; end if;
    insert into public.video_recipients (video_id, recipient_id, details)
    values (p_video_id, rid, det)
    on conflict (video_id, recipient_id) do update set details = excluded.details;
    saved := saved + 1;
  end loop;

  select count(*) into total from public.video_recipients where video_id = p_video_id;
  if total > 50000 then raise exception 'too_many_recipients'; end if;
  return saved;
end;
$$;

create or replace function public.clear_video_recipients(p_video_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me text := auth.jwt() ->> 'sub';
begin
  if me is null or not exists (
    select 1 from public.published_videos v where v.id = p_video_id and v.clerk_user_id = me
  ) then
    raise exception 'not_found';
  end if;
  delete from public.video_recipients where video_id = p_video_id;
end;
$$;

-- Public: one recipient's details for one published video, or null. No listing.
create or replace function public.video_recipient_values(p_video_id text, p_recipient_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare out jsonb;
begin
  if p_video_id is null or p_video_id !~ '^[A-Za-z0-9_-]{8,32}$' then return null; end if;
  if p_recipient_id is null or p_recipient_id !~ '^[A-Za-z0-9_-]{1,80}$' then return null; end if;
  select r.details into out
    from public.video_recipients r
    join public.published_videos v on v.id = r.video_id and v.published = true
   where r.video_id = p_video_id and r.recipient_id = p_recipient_id;
  return out;
end;
$$;

revoke all on function public.sanitize_recipient_details(jsonb) from public;
revoke all on function public.save_video_recipients(text, jsonb, boolean) from public;
revoke all on function public.clear_video_recipients(text) from public;
revoke all on function public.video_recipient_values(text, text) from public;
grant execute on function public.save_video_recipients(text, jsonb, boolean) to anon, authenticated;
grant execute on function public.clear_video_recipients(text) to anon, authenticated;
grant execute on function public.video_recipient_values(text, text) to anon, authenticated;

-- Application labels (same convention as 20261112040000_label_smartvideo_timeline_objects.sql).
comment on table public.video_recipients is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: per-recipient name-like details for email campaign links (looked up by recipient id; no contact data).';
comment on function public.sanitize_recipient_details(jsonb) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.save_video_recipients(text, jsonb, boolean) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.clear_video_recipients(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_recipient_values(text, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
