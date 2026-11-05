-- ===========================================================================
-- published_video_events.sql
--
-- Per-contact analytics for interactive videos (/watch/<id>). Personal share
-- links carry ?c=<contactId>; the public player records what each contact
-- did: opened the page (view), pressed play, watched to the end, clicked a
-- CTA, or left a lead. The owner sees totals per contact in the Share panel.
--
-- Writes only go through record_video_event() (security definer): it accepts
-- a small fixed set of event kinds, only for published videos, and validates
-- the contact and clip ids. Anonymous viewers can't read events. Owners read
-- their own videos' events through video_events_by_contact().
-- ===========================================================================

create table if not exists public.published_video_events (
  id bigint generated always as identity primary key,
  video_id text not null references public.published_videos (id) on delete cascade,
  contact_id text
    check (contact_id is null or contact_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  kind text not null
    check (kind in ('view', 'play', 'complete', 'cta_click', 'lead')),
  clip_id text
    check (clip_id is null or char_length(clip_id) <= 80),
  created_at timestamptz not null default now()
);

create index if not exists published_video_events_video_idx
  on public.published_video_events (video_id, contact_id, kind);

alter table public.published_video_events enable row level security;

drop policy if exists "Owners read their video events" on public.published_video_events;
-- Same identity model as published_videos: the verified Clerk `sub`, which
-- may arrive under either API role.
create policy "Owners read their video events"
  on public.published_video_events
  for select
  to anon, authenticated
  using (exists (
    select 1 from public.published_videos v
     where v.id = published_video_events.video_id
       and v.clerk_user_id = (select auth.jwt() ->> 'sub')
  ));

-- No direct writes from API roles; events come in through the function below.
revoke insert, update, delete on public.published_video_events from anon, authenticated;
grant select on public.published_video_events to anon, authenticated;

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
end;
$$;

revoke all on function public.record_video_event(text, text, text, text) from public;
grant execute on function public.record_video_event(text, text, text, text) to anon, authenticated;

-- Totals per contact for one of the caller's videos (RLS applies: owners only).
create or replace function public.video_events_by_contact(video_id text)
returns table (
  contact_id text,
  views bigint,
  plays bigint,
  completes bigint,
  cta_clicks bigint,
  leads bigint,
  last_seen timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.contact_id,
         count(*) filter (where e.kind = 'view'),
         count(*) filter (where e.kind = 'play'),
         count(*) filter (where e.kind = 'complete'),
         count(*) filter (where e.kind = 'cta_click'),
         count(*) filter (where e.kind = 'lead'),
         max(e.created_at)
    from public.published_video_events e
   where e.video_id = video_events_by_contact.video_id
   group by e.contact_id
   order by max(e.created_at) desc;
$$;

revoke all on function public.video_events_by_contact(text) from public;
grant execute on function public.video_events_by_contact(text) to anon, authenticated;
