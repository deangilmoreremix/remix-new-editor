-- Video Outreach: how much each prospect watched, and alerts when a prospect watches or clicks
-- (in the notification bell, and optionally by email and Slack). Written for src/components/OutreachStudio.js
-- and supabase/functions/outreach-alerts.

-- 1) Who each personal link belongs to, so an alert can say "Mike Ross watched". Owner-only; filled when a
--    campaign is generated. Prospects' details stay in the owner's own account (no one else can read them).
create table if not exists public.outreach_prospects (
  video_id text not null references public.published_videos (id) on delete cascade,
  contact_id text not null check (contact_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  clerk_user_id text not null default (auth.jwt() ->> 'sub'),
  name text check (name is null or char_length(name) <= 120),
  company text check (company is null or char_length(company) <= 120),
  email text check (email is null or char_length(email) <= 200),
  updated_at timestamptz not null default now(),
  primary key (video_id, contact_id)
);
alter table public.outreach_prospects enable row level security;
drop policy if exists "Owners manage their prospects" on public.outreach_prospects;
create policy "Owners manage their prospects"
  on public.outreach_prospects for all to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check (
    (select auth.jwt() ->> 'sub') = clerk_user_id
    and exists (select 1 from public.published_videos p where p.id = video_id and p.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );
grant select, insert, update, delete on public.outreach_prospects to anon, authenticated;

-- 2) Where alerts go. Owner-only.
create table if not exists public.outreach_alert_settings (
  clerk_user_id text primary key default (auth.jwt() ->> 'sub'),
  enabled boolean not null default true,
  on_watch boolean not null default true,
  on_click boolean not null default true,
  email text check (email is null or (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  slack_webhook text check (slack_webhook is null or slack_webhook ~ '^https://hooks\.slack\.com/services/[A-Za-z0-9/_-]{10,200}$'),
  updated_at timestamptz not null default now()
);
alter table public.outreach_alert_settings enable row level security;
drop policy if exists "Owners manage their alert settings" on public.outreach_alert_settings;
create policy "Owners manage their alert settings"
  on public.outreach_alert_settings for all to anon, authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id)
  with check ((select auth.jwt() ->> 'sub') = clerk_user_id);
grant select, insert, update, delete on public.outreach_alert_settings to anon, authenticated;

-- 4) Email / Slack deliveries waiting to be sent (by the outreach-alerts function). Service role only.
create table if not exists public.outreach_alert_queue (
  id bigint generated always as identity primary key,
  clerk_user_id text not null,
  video_id text references public.published_videos (id) on delete cascade,
  title text not null check (char_length(title) <= 200),
  summary text not null check (char_length(summary) <= 600),
  link text check (link is null or char_length(link) <= 500),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists outreach_alert_queue_pending_idx on public.outreach_alert_queue (created_at) where status = 'pending';
alter table public.outreach_alert_queue enable row level security;
revoke all on public.outreach_alert_queue from anon, authenticated;

-- 5) The trigger: a prospect (a viewing session with a contact id) on a Video Outreach video starts
--    watching, reaches 75%, finishes, or clicks the booking button. One alert per prospect per stage.
create or replace function public._on_outreach_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact text;
  pv record;
  who text;
  stage text;
  ntype text;
  title text;
  summary text;
  prefs record;
  new_id uuid;
begin
  if new.type not in ('play', 'progress_75', 'complete', 'cta_click', 'call_click') then return new; end if;
  select s.contact_id into contact from public.video_view_sessions s where s.id = new.session_id;
  if contact is null then return new; end if;
  select p.clerk_user_id, p.title, p.project into pv from public.published_videos p where p.id = new.video_id;
  if not found or coalesce(pv.project ->> 'kind', '') <> 'outreach' then return new; end if;
  select coalesce(nullif(op.name, ''), nullif(op.email, '')) into who
    from public.outreach_prospects op where op.video_id = new.video_id and op.contact_id = contact;
  who := coalesce(who, 'A prospect');
  if new.type in ('cta_click', 'call_click') then
    stage := 'click'; ntype := 'prospect_clicked';
    title := left(who || ' clicked your booking button', 200);
    summary := left(format('%s clicked the button on your video "%s". Follow up while it is fresh.', who, pv.title), 600);
  elsif new.type = 'play' then
    stage := 'play'; ntype := 'prospect_watched';
    title := left(who || ' is watching your video', 200);
    summary := left(format('%s started watching "%s".', who, pv.title), 600);
  else
    stage := '75'; ntype := 'prospect_watched';
    title := left(who || ' watched most of your video', 200);
    summary := left(format('%s watched %s of "%s".', who, case when new.type = 'complete' then 'all' else '75%' end, pv.title), 600);
  end if;
  insert into public.owner_notifications (clerk_user_id, video_id, project_id, type, title, summary, suggestion, metrics, dedupe_key)
  values (pv.clerk_user_id, new.video_id, (select project_id from public.published_videos where id = new.video_id), ntype, title, summary,
          case when stage = 'click' then 'Reach out today.' else null end,
          jsonb_build_object('contact', contact, 'stage', stage), 'outreach:' || new.video_id || ':' || contact || ':' || stage)
  on conflict (clerk_user_id, dedupe_key) do nothing
  returning id into new_id;
  if new_id is null then return new; end if; -- already alerted for this prospect and stage
  select * into prefs from public.outreach_alert_settings where clerk_user_id = pv.clerk_user_id;
  if found and prefs.enabled and (prefs.email is not null or prefs.slack_webhook is not null)
     and ((stage = 'click' and prefs.on_click) or (stage <> 'click' and prefs.on_watch)) then
    insert into public.outreach_alert_queue (clerk_user_id, video_id, title, summary)
    values (pv.clerk_user_id, new.video_id, title, summary);
    -- Ask the sender to deliver now (asynchronous; a failed call is retried by the cron job below).
    perform net.http_post(
      url := 'https://bzxohkrxcwodllketcpz.supabase.co/functions/v1/outreach-alerts',
      body := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb);
  end if;
  return new;
exception when others then
  -- Alerts must never break the viewer's event recording.
  return new;
end;
$$;
revoke all on function public._on_outreach_event() from public, anon, authenticated;
drop trigger if exists video_events_outreach_alert on public.video_events;
create trigger video_events_outreach_alert after insert on public.video_events
  for each row execute function public._on_outreach_event();

-- Retries: every 10 minutes, ask the sender to deliver anything still pending.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'outreach-alerts-retry') then
    perform cron.unschedule('outreach-alerts-retry');
  end if;
  perform cron.schedule('outreach-alerts-retry', '*/10 * * * *',
    $cron$select net.http_post(url := 'https://bzxohkrxcwodllketcpz.supabase.co/functions/v1/outreach-alerts', body := '{}'::jsonb, headers := '{"Content-Type": "application/json"}'::jsonb) where exists (select 1 from public.outreach_alert_queue where status = 'pending')$cron$);
end $$;

-- The bell alert type and the new per-prospect totals are in 20261123000000_outreach_alerts_followup.sql.
