-- Talk live call history (Video Outreach).
-- The studio tab that handles a prospect's call writes one row once the outcome is known
-- (src/lib/outreach/liveCall.js createHostLine onCallLog; src/components/OutreachStudio.js).
-- Calls are peer to peer; nothing about the media is stored, only who called, when, and how it went.

create table if not exists public.outreach_live_calls (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  video_id text not null,
  call_id text not null check (call_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  contact_id text check (contact_id is null or length(contact_id) <= 120),
  caller_name text check (caller_name is null or length(caller_name) <= 200),
  outcome text not null check (outcome in ('answered', 'missed', 'declined', 'failed')),
  rang_at timestamptz not null,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0 and duration_seconds <= 86400),
  created_at timestamptz not null default now(),
  unique (clerk_user_id, call_id)
);

create index if not exists outreach_live_calls_owner_video_idx
  on public.outreach_live_calls (clerk_user_id, video_id, rang_at desc);

alter table public.outreach_live_calls enable row level security;

-- Owners read their own calls, and add calls only for videos they own.
drop policy if exists "Owners read own live calls" on public.outreach_live_calls;
create policy "Owners read own live calls" on public.outreach_live_calls for select to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

drop policy if exists "Owners log calls on own videos" on public.outreach_live_calls;
create policy "Owners log calls on own videos" on public.outreach_live_calls for insert to authenticated
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (select 1 from public.published_videos v
                 where v.id = outreach_live_calls.video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );

revoke all on public.outreach_live_calls from anon, authenticated;
grant select, insert on public.outreach_live_calls to authenticated;
