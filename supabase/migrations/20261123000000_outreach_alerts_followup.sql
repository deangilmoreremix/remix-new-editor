-- Video Outreach alerts, finished without replacing anything that already existed.
--
-- 1) Bell alerts use the existing "followup_opportunity" type, so owner_notifications' type list stays as it is.
--    They are still told apart as outreach alerts by dedupe_key 'outreach:<video>:<contact>:<stage>' and
--    metrics.kind = 'outreach' (OutreachStudio's activity list filters on these).
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
    stage := 'click'; ntype := 'followup_opportunity';
    title := left(who || ' clicked your booking button', 200);
    summary := left(format('%s clicked the button on your video "%s". Follow up while it is fresh.', who, pv.title), 600);
  elsif new.type = 'play' then
    stage := 'play'; ntype := 'followup_opportunity';
    title := left(who || ' is watching your video', 200);
    summary := left(format('%s started watching "%s".', who, pv.title), 600);
  else
    stage := '75'; ntype := 'followup_opportunity';
    title := left(who || ' watched most of your video', 200);
    summary := left(format('%s watched %s of "%s".', who, case when new.type = 'complete' then 'all' else '75%' end, pv.title), 600);
  end if;
  insert into public.owner_notifications (clerk_user_id, video_id, project_id, type, title, summary, suggestion, metrics, dedupe_key)
  values (pv.clerk_user_id, new.video_id, (select project_id from public.published_videos where id = new.video_id), ntype, title, summary,
          case when stage = 'click' then 'Reach out today.' else null end,
          jsonb_build_object('kind', 'outreach', 'contact', contact, 'stage', stage), 'outreach:' || new.video_id || ':' || contact || ':' || stage)
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

-- 2) Per-prospect totals with how far they got (0-100) and how long they watched (seconds), as a new
--    function so the existing video_events_by_contact stays as it is (fetchVideoStats falls back to it).
create function public.video_events_by_contact_v2(video_id text)
returns table (contact_id text, views bigint, plays bigint, completes bigint, cta_clicks bigint, leads bigint, last_seen timestamptz, max_progress numeric, watch_seconds numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select x.contact_id, sum(x.views)::bigint, sum(x.plays)::bigint, sum(x.completes)::bigint,
         sum(x.cta_clicks)::bigint, sum(x.leads)::bigint, max(x.last_seen),
         max(x.max_progress) * 100, sum(x.watch_seconds)
    from (
      select e.contact_id,
             count(*) filter (where e.kind = 'view') as views, count(*) filter (where e.kind = 'play') as plays,
             count(*) filter (where e.kind = 'complete') as completes, count(*) filter (where e.kind = 'cta_click') as cta_clicks,
             count(*) filter (where e.kind = 'lead') as leads, max(e.created_at) as last_seen,
             0::numeric as max_progress, 0::numeric as watch_seconds
        from public.published_video_events e where e.video_id = video_events_by_contact_v2.video_id group by e.contact_id
      union all
      select s.contact_id,
             count(*) filter (where ev.type = 'page_open'), count(*) filter (where ev.type = 'play'),
             count(*) filter (where ev.type = 'complete'), count(*) filter (where ev.type in ('cta_click', 'call_click')),
             count(*) filter (where ev.type = 'lead_submit'), max(ev.created_at), 0::numeric, 0::numeric
        from public.video_view_sessions s join public.video_events ev on ev.session_id = s.id
       where s.video_id = video_events_by_contact_v2.video_id group by s.contact_id
      union all
      select s.contact_id, 0, 0, 0, 0, 0, max(s.last_event_at), max(s.max_progress), sum(s.watch_seconds)
        from public.video_view_sessions s
       where s.video_id = video_events_by_contact_v2.video_id group by s.contact_id
    ) x
   group by x.contact_id order by max(x.last_seen) desc nulls last;
$$;
revoke all on function public.video_events_by_contact_v2(text) from public;
grant execute on function public.video_events_by_contact_v2(text) to anon, authenticated;

-- 3) Index for the queue's foreign key (Supabase performance check).
create index if not exists outreach_alert_queue_video_id_idx on public.outreach_alert_queue (video_id);
