-- ===========================================================================
-- video_analytics.sql — first-party analytics for published interactive videos
--
-- Collection: the Netlify function /api/video-events validates a batch and
-- calls ingest_video_events() with the service role (the only writer). Browsers
-- never get table or function access for writing, and never send an owner id:
-- the owner and revision are resolved here from published_videos.
--
-- Definitions (see docs/video-analytics.md):
--   page visit   valid page_open (once per session)
--   play         first playback start of a session, plus each replay (max 10)
--   session      a page session that started playback
--   completed    session that reached the end (complete event)
--   watch time   sum of client-measured continuous-playback segments, each
--                clamped by wall-clock time since the session began, so
--                background tabs / duplicate batches cannot inflate it
--   unique viewer distinct hashed random viewer id (only when the viewer's
--                browser allowed one); sessions without an id are counted
--                separately and never presented as people
--   CTA clicks   distinct CTA / call / product / overlay interactions per
--                session (a repeated click on the same target counts once)
--
-- Storage is bounded: watch segments are aggregated into per-session coverage
-- (not stored as rows), raw events are capped per session and pruned after 90
-- days, daily aggregates are kept. Retention and section engagement are computed
-- from session coverage, so they follow any reporting period within that window.
-- ===========================================================================

create table if not exists public.video_view_sessions (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.published_videos (id) on delete cascade,
  revision integer not null default 1,
  session_key text not null check (session_key ~ '^[A-Za-z0-9_-]{16,64}$'),
  viewer_hash text check (viewer_hash is null or viewer_hash ~ '^[a-f0-9]{16,64}$'),
  contact_id text check (contact_id is null or contact_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  device_class text check (device_class is null or device_class in ('mobile', 'tablet', 'desktop')),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 120),
  is_return boolean not null default false,
  played boolean not null default false,
  completed boolean not null default false,
  watch_seconds numeric not null default 0,
  max_progress numeric not null default 0 check (max_progress between 0 and 1),
  covered smallint[] not null default '{}',
  last_watch_seq integer not null default -1,
  event_count integer not null default 0,
  started_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  unique (video_id, session_key)
);
create index if not exists video_view_sessions_video_started_idx
  on public.video_view_sessions (video_id, started_at desc);
create index if not exists video_view_sessions_viewer_idx
  on public.video_view_sessions (video_id, viewer_hash) where viewer_hash is not null;

create table if not exists public.video_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.video_view_sessions (id) on delete cascade,
  video_id text not null references public.published_videos (id) on delete cascade,
  revision integer not null default 1,
  seq integer not null,
  type text not null check (type in (
    'page_open', 'play', 'pause', 'resume', 'complete',
    'progress_25', 'progress_50', 'progress_75', 'progress_90',
    'replay', 'section_rewatch', 'cta_click', 'product_select', 'call_click',
    'overlay_click', 'lead_submit', 'return', 'error')),
  t numeric check (t is null or (t >= 0 and t <= 86400)),
  clip_id text check (clip_id is null or char_length(clip_id) <= 80),
  section_id text check (section_id is null or char_length(section_id) <= 80),
  props jsonb check (props is null or (jsonb_typeof(props) = 'object' and pg_column_size(props) <= 512)),
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);
create unique index if not exists video_events_dedupe_idx
  on public.video_events (session_id, dedupe_key) where dedupe_key is not null;
create index if not exists video_events_video_created_idx
  on public.video_events (video_id, created_at desc);
create index if not exists video_events_video_type_idx
  on public.video_events (video_id, type, created_at desc);

create table if not exists public.video_analytics_daily (
  video_id text not null references public.published_videos (id) on delete cascade,
  day date not null,
  page_visits integer not null default 0,
  plays integer not null default 0,
  sessions integer not null default 0,
  completes integer not null default 0,
  progress_25 integer not null default 0,
  progress_50 integer not null default 0,
  progress_75 integer not null default 0,
  progress_90 integer not null default 0,
  cta_clicks integer not null default 0,
  call_clicks integer not null default 0,
  overlay_clicks integer not null default 0,
  product_selects integer not null default 0,
  leads integer not null default 0,
  returns integer not null default 0,
  errors integer not null default 0,
  watch_seconds numeric not null default 0,
  primary key (video_id, day)
);

-- One row per (video, day, viewer): exact unique-viewer counts for any range.
create table if not exists public.video_daily_viewers (
  video_id text not null references public.published_videos (id) on delete cascade,
  day date not null,
  viewer_hash text not null,
  primary key (video_id, day, viewer_hash)
);

do $$
declare t text;
begin
  foreach t in array array['video_view_sessions', 'video_events', 'video_analytics_daily', 'video_daily_viewers']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Owners read own video analytics" on public.%I', t);
    execute format($p$create policy "Owners read own video analytics" on public.%I for select to anon, authenticated
      using (exists (select 1 from public.published_videos v
                      where v.id = %I.video_id and v.clerk_user_id = (select auth.jwt() ->> 'sub')))$p$, t, t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- ingest
create or replace function public._video_daily_bump(p_video text, p_day date, p_col text, p_n numeric default 1)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_col <> all (array['page_visits', 'plays', 'sessions', 'completes', 'progress_25', 'progress_50', 'progress_75',
                         'progress_90', 'cta_clicks', 'call_clicks', 'overlay_clicks', 'product_selects', 'leads',
                         'returns', 'errors', 'watch_seconds']) then
    raise exception 'bad column';
  end if;
  execute format(
    'insert into public.video_analytics_daily (video_id, day, %1$I) values ($1, $2, $3)
     on conflict (video_id, day) do update set %1$I = public.video_analytics_daily.%1$I + excluded.%1$I', p_col)
  using p_video, p_day, p_n;
end;
$$;

create or replace function public.ingest_video_events(
  p_video_id text,
  p_session_key text,
  p_viewer_hash text,
  p_contact_id text,
  p_device text,
  p_referrer text,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  s public.video_view_sessions;
  ev jsonb;
  typ text;
  seqv integer;
  tv numeric;
  clip text;
  sec text;
  props jsonb;
  dkey text;
  n integer;
  accepted integer := 0;
  dups integer := 0;
  day date := (now() at time zone 'utc')::date;
  dur numeric;
  t0 numeric;
  t1 numeric;
  allowed numeric;
  credit numeric;
  b0 integer;
  b1 integer;
  nb smallint[];
  b integer;
  w_seconds numeric;
  w_covered smallint[];
  w_progress numeric;
  w_seq integer;
  w_events integer;
  w_played boolean;
  w_completed boolean;
  replays integer;
begin
  select id, revision, (project ->> 'timelineSeconds')::numeric as dur into v
    from public.published_videos where id = p_video_id and published = true;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown_video'); end if;
  if p_session_key is null or p_session_key !~ '^[A-Za-z0-9_-]{16,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_session');
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 25 then
    return jsonb_build_object('ok', false, 'error', 'bad_events');
  end if;
  if p_viewer_hash is not null and p_viewer_hash !~ '^[a-f0-9]{16,64}$' then p_viewer_hash := null; end if;
  if p_contact_id is not null and p_contact_id !~ '^[A-Za-z0-9_-]{1,80}$' then p_contact_id := null; end if;
  if p_device is not null and p_device not in ('mobile', 'tablet', 'desktop') then p_device := null; end if;
  if p_referrer is not null and (char_length(p_referrer) > 120 or p_referrer !~ '^[A-Za-z0-9.-]+$') then p_referrer := null; end if;

  insert into public.video_view_sessions (video_id, revision, session_key, viewer_hash, contact_id, device_class, referrer_host, is_return)
  values (
    p_video_id, v.revision, p_session_key, p_viewer_hash, p_contact_id, p_device, p_referrer,
    p_viewer_hash is not null and exists (
      select 1 from public.video_view_sessions o
       where o.video_id = p_video_id and o.viewer_hash = p_viewer_hash and o.session_key <> p_session_key)
  )
  on conflict (video_id, session_key) do nothing;
  get diagnostics n = row_count;

  select * into s from public.video_view_sessions where video_id = p_video_id and session_key = p_session_key for update;
  w_seconds := s.watch_seconds; w_covered := s.covered; w_progress := s.max_progress; w_seq := s.last_watch_seq;
  w_events := s.event_count; w_played := s.played; w_completed := s.completed;
  dur := case when v.dur is not null and v.dur > 0 then v.dur else null end;

  -- A returning viewer (known hashed id seen in an earlier session): record once.
  if n = 1 and s.is_return then
    insert into public.video_events (session_id, video_id, revision, seq, type, dedupe_key)
    values (s.id, p_video_id, v.revision, -1, 'return', 'return') on conflict do nothing;
    get diagnostics n = row_count;
    if n = 1 then perform public._video_daily_bump(p_video_id, day, 'returns'); end if;
  end if;

  for ev in select value from jsonb_array_elements(p_events) loop
    typ := ev ->> 'type';
    if coalesce(ev ->> 'seq', '') !~ '^[0-9]{1,6}$' then dups := dups + 1; continue; end if;
    seqv := (ev ->> 'seq')::integer;

    -- Continuous playback segment (aggregated, never stored as a row).
    if typ = 'watch' then
      if seqv <= w_seq then dups := dups + 1; continue; end if; -- retry of a processed batch
      w_seq := seqv;
      if coalesce(ev ->> 't0', '') !~ '^[0-9]{1,5}(\.[0-9]{1,3})?$' or coalesce(ev ->> 't1', '') !~ '^[0-9]{1,5}(\.[0-9]{1,3})?$' then
        dups := dups + 1; continue;
      end if;
      t0 := (ev ->> 't0')::numeric; t1 := (ev ->> 't1')::numeric;
      if t1 <= t0 or t1 - t0 > 120 or t0 > 86400 then dups := dups + 1; continue; end if;
      -- Can't have watched more than the wall-clock time since the session began.
      allowed := greatest(0, extract(epoch from (now() - s.started_at)) + 10 - w_seconds);
      credit := least(t1 - t0, allowed);
      if credit > 0 then
        w_seconds := w_seconds + credit;
        perform public._video_daily_bump(p_video_id, day, 'watch_seconds', credit);
        if dur is null then dur := greatest(t0 + credit, 1); end if;
        b0 := least(99, greatest(0, floor(t0 / dur * 100)::integer));
        b1 := least(99, greatest(0, floor((t0 + credit) / dur * 100)::integer));
        nb := '{}';
        for b in b0..b1 loop
          if not (b::smallint = any(w_covered)) then nb := nb || b::smallint; end if;
        end loop;
        w_covered := w_covered || nb;
        w_progress := greatest(w_progress, least(1, (t0 + credit) / dur));
      end if;
      accepted := accepted + 1;
      continue;
    end if;

    if typ is null or typ not in ('page_open', 'play', 'pause', 'resume', 'complete', 'progress_25', 'progress_50',
        'progress_75', 'progress_90', 'replay', 'section_rewatch', 'cta_click', 'product_select', 'call_click',
        'overlay_click', 'lead_submit', 'error') then
      dups := dups + 1; continue;
    end if;
    if w_events >= 200 then dups := dups + 1; continue; end if; -- bounded raw rows per session

    tv := case when coalesce(ev ->> 't', '') ~ '^[0-9]{1,5}(\.[0-9]{1,3})?$' then least((ev ->> 't')::numeric, 86400) end;
    clip := nullif(left(ev ->> 'clip', 80), '');
    sec := nullif(left(ev ->> 'section', 80), '');
    props := null;
    if jsonb_typeof(ev -> 'props') = 'object' then
      props := jsonb_strip_nulls(jsonb_build_object(
        'label', left(ev -> 'props' ->> 'label', 80),
        'pricing', case when (ev -> 'props' ->> 'pricing') in ('true', 'false') then ((ev -> 'props' ->> 'pricing')::boolean) end,
        'reason', left(ev -> 'props' ->> 'reason', 80)));
      if props = '{}'::jsonb then props := null; end if;
    end if;

    dkey := case
      when typ in ('page_open', 'play', 'complete', 'progress_25', 'progress_50', 'progress_75', 'progress_90') then typ
      when typ in ('cta_click', 'call_click', 'product_select', 'overlay_click', 'lead_submit') then typ || ':' || coalesce(clip, '')
      when typ = 'section_rewatch' then typ || ':' || coalesce(sec, clip, '')
      else null end;

    if typ = 'replay' then
      select count(*) into replays from public.video_events where session_id = s.id and type = 'replay';
      if replays >= 10 then dups := dups + 1; continue; end if;
    end if;

    insert into public.video_events (session_id, video_id, revision, seq, type, t, clip_id, section_id, props, dedupe_key)
    values (s.id, p_video_id, v.revision, seqv, typ, tv, clip, sec, props, dkey)
    on conflict do nothing;
    get diagnostics n = row_count;
    if n = 0 then dups := dups + 1; continue; end if;
    accepted := accepted + 1;
    w_events := w_events + 1;

    if typ = 'page_open' then
      perform public._video_daily_bump(p_video_id, day, 'page_visits');
      update public.published_videos set view_count = view_count + 1 where id = p_video_id;
    elsif typ = 'play' then
      w_played := true;
      perform public._video_daily_bump(p_video_id, day, 'plays');
      perform public._video_daily_bump(p_video_id, day, 'sessions');
      if s.viewer_hash is not null then
        insert into public.video_daily_viewers (video_id, day, viewer_hash) values (p_video_id, day, s.viewer_hash) on conflict do nothing;
      end if;
    elsif typ = 'replay' then
      perform public._video_daily_bump(p_video_id, day, 'plays');
    elsif typ = 'complete' then
      w_completed := true;
      perform public._video_daily_bump(p_video_id, day, 'completes');
    elsif typ in ('progress_25', 'progress_50', 'progress_75', 'progress_90') then
      perform public._video_daily_bump(p_video_id, day, typ);
    elsif typ in ('cta_click', 'call_click', 'overlay_click', 'product_select') then
      perform public._video_daily_bump(p_video_id, day, typ || case when typ = 'product_select' then 's' else 's' end);
    elsif typ = 'lead_submit' then
      perform public._video_daily_bump(p_video_id, day, 'leads');
    elsif typ = 'error' then
      perform public._video_daily_bump(p_video_id, day, 'errors');
    end if;
  end loop;

  update public.video_view_sessions
     set watch_seconds = w_seconds, covered = w_covered, max_progress = w_progress, last_watch_seq = w_seq,
         event_count = w_events, played = w_played, completed = w_completed, last_event_at = now()
   where id = s.id;

  return jsonb_build_object('ok', true, 'accepted', accepted, 'duplicates', dups);
end;
$$;

revoke all on function public._video_daily_bump(text, date, text, numeric) from public;
revoke all on function public.ingest_video_events(text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_video_events(text, text, text, text, text, text, jsonb) to service_role;

-- NOTE: the old unauthenticated writers (record_video_event / increment_video_view) are revoked by the LATER
-- migration 20261112050000, after the new app version (which uses the validated, rate-limited server path above)
-- is deployed, so the previous app version keeps counting views during rollout.

-- ---------------------------------------------------------------- owner reads
-- All SECURITY INVOKER: row-level security limits every query to the caller's
-- own videos. Dates are UTC days.
create or replace function public.video_analytics_summary(p_video_id text, p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with d as (
    select coalesce(sum(page_visits), 0) as page_visits, coalesce(sum(plays), 0) as plays,
           coalesce(sum(sessions), 0) as sessions, coalesce(sum(completes), 0) as completes,
           coalesce(sum(watch_seconds), 0) as watch_seconds, coalesce(sum(cta_clicks), 0) as cta_clicks,
           coalesce(sum(call_clicks), 0) as call_clicks, coalesce(sum(overlay_clicks), 0) as overlay_clicks,
           coalesce(sum(product_selects), 0) as product_selects, coalesce(sum(leads), 0) as leads,
           coalesce(sum(errors), 0) as errors, coalesce(sum(returns), 0) as returns
      from public.video_analytics_daily
     where video_id = p_video_id and day between p_from and p_to),
  u as (
    select count(distinct viewer_hash) as unique_viewers from public.video_daily_viewers
     where video_id = p_video_id and day between p_from and p_to),
  s as (
    select count(*) filter (where played) as played_sessions,
           count(*) filter (where played and viewer_hash is null) as played_without_id,
           count(*) filter (where played and is_return) as returning_sessions,
           count(*) filter (where played and not is_return) as new_sessions,
           coalesce(avg(max_progress) filter (where played), 0) as avg_progress
      from public.video_view_sessions
     where video_id = p_video_id and (started_at at time zone 'utc')::date between p_from and p_to),
  r as (
    select count(*) filter (where n >= 2) as repeaters, count(*) as viewers from (
      select viewer_hash, count(*) as n from public.video_view_sessions
       where video_id = p_video_id and played and viewer_hash is not null
         and (started_at at time zone 'utc')::date between p_from and p_to
       group by viewer_hash) x)
  select jsonb_build_object(
    'page_visits', d.page_visits,
    'plays', d.plays,
    'sessions', d.sessions,
    'unique_viewers', u.unique_viewers,
    'sessions_without_viewer_id', s.played_without_id,
    'completed_sessions', d.completes,
    'completion_rate', case when d.sessions > 0 then round(d.completes::numeric / d.sessions, 4) end,
    'watch_seconds', d.watch_seconds,
    'avg_watch_seconds', case when d.sessions > 0 then round(d.watch_seconds / d.sessions, 1) end,
    'avg_percent_watched', case when s.played_sessions > 0 then round(s.avg_progress, 4) end,
    'repeat_view_rate', case when r.viewers > 0 then round(r.repeaters::numeric / r.viewers, 4) end,
    'new_sessions', s.new_sessions,
    'returning_sessions', s.returning_sessions,
    'cta_clicks', d.cta_clicks,
    'call_clicks', d.call_clicks,
    'overlay_clicks', d.overlay_clicks,
    'product_selects', d.product_selects,
    'leads', d.leads,
    'lead_conversion_rate', case when d.sessions > 0 then round(d.leads::numeric / d.sessions, 4) end,
    'cta_conversion_rate', case when d.sessions > 0 then round(d.cta_clicks::numeric / d.sessions, 4) end,
    'errors', d.errors
  ) from d, u, s, r;
$$;

create or replace function public.video_analytics_timeseries(p_video_id text, p_from date, p_to date)
returns table (day date, page_visits integer, plays integer, unique_viewers bigint, completes integer, cta_clicks integer, leads integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select g.day::date,
         coalesce(a.page_visits, 0), coalesce(a.plays, 0),
         (select count(*) from public.video_daily_viewers vv where vv.video_id = p_video_id and vv.day = g.day::date),
         coalesce(a.completes, 0), coalesce(a.cta_clicks, 0), coalesce(a.leads, 0)
    from generate_series(p_from, least(p_to, p_from + 400), interval '1 day') as g(day)
    left join public.video_analytics_daily a on a.video_id = p_video_id and a.day = g.day::date
   order by g.day;
$$;

-- Retention for a reporting period: share of played sessions (started in the
-- range) that watched each 1% slice of the video. Computed from per-session
-- coverage, so it follows the selected dates exactly.
create or replace function public.video_retention_curve(p_video_id text, p_from date, p_to date)
returns table (bucket integer, viewers bigint, base bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with ss as (
    select covered from public.video_view_sessions
     where video_id = p_video_id and played and (started_at at time zone 'utc')::date between p_from and p_to),
  base as (select count(*) as n from ss),
  cnt as (select b::integer as bucket, count(*) as viewers from ss, unnest(ss.covered) b group by b)
  select g.b, coalesce(c.viewers, 0)::bigint, (select n from base)
    from generate_series(0, 99) as g(b) left join cnt c on c.bucket = g.b
   order by g.b;
$$;

-- Average share of each section (given as [{id,start,end}] in seconds) that
-- played sessions in the range actually watched. null when nothing was played.
create or replace function public.video_section_engagement(p_video_id text, p_sections jsonb, p_from date, p_to date)
returns table (section_id text, engagement_percent numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with d as (select (project ->> 'timelineSeconds')::numeric as dur from public.published_videos where id = p_video_id),
  sec as (
    select x ->> 'id' as id,
           least(99, greatest(0, floor((x ->> 'start')::numeric / (select dur from d) * 100)::int)) as b0,
           least(99, greatest(0, ceil((x ->> 'end')::numeric / (select dur from d) * 100)::int - 1)) as b1
      from jsonb_array_elements(p_sections) x
     where (select dur from d) is not null and (select dur from d) > 0),
  ss as (
    select covered from public.video_view_sessions
     where video_id = p_video_id and played and (started_at at time zone 'utc')::date between p_from and p_to)
  select sec.id,
         case when count(ss.covered) = 0 then null
              else round(100.0 * avg((select count(*) from unnest(ss.covered) b where b between sec.b0 and greatest(sec.b0, sec.b1))::numeric
                                     / (greatest(sec.b0, sec.b1) - sec.b0 + 1)), 1) end
    from sec left join ss on true
   group by sec.id, sec.b0, sec.b1;
$$;

create or replace function public.video_cta_performance(p_video_id text, p_from date, p_to date)
returns table (type text, clip_id text, label text, sessions bigint, eligible_sessions bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with elig as (
    select count(*) as n from public.video_view_sessions
     where video_id = p_video_id and played and (started_at at time zone 'utc')::date between p_from and p_to)
  select e.type, e.clip_id, max(e.props ->> 'label'), count(distinct e.session_id), (select n from elig)
    from public.video_events e
   where e.video_id = p_video_id
     and e.type in ('cta_click', 'call_click', 'product_select', 'overlay_click', 'lead_submit')
     and (e.created_at at time zone 'utc')::date between p_from and p_to
   group by e.type, e.clip_id
   order by count(distinct e.session_id) desc
   limit 50;
$$;

-- One row per video the caller owns (drives the Projects cards).
create or replace function public.owner_video_stats(p_from date, p_to date)
returns table (video_id text, project_id uuid, title text, published boolean, plays bigint, unique_viewers bigint,
               completion_pct numeric, cta_clicks bigint, call_clicks bigint, leads bigint, last_play_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select v.id, v.project_id, v.title, v.published,
         coalesce(sum(a.plays), 0)::bigint,
         (select count(distinct vv.viewer_hash) from public.video_daily_viewers vv
           where vv.video_id = v.id and vv.day between p_from and p_to),
         case when coalesce(sum(a.sessions), 0) > 0 then round(100.0 * sum(a.completes) / sum(a.sessions), 1) end,
         coalesce(sum(a.cta_clicks), 0)::bigint, coalesce(sum(a.call_clicks), 0)::bigint, coalesce(sum(a.leads), 0)::bigint,
         (select max(s.started_at) from public.video_view_sessions s where s.video_id = v.id and s.played)
    from public.published_videos v
    left join public.video_analytics_daily a on a.video_id = v.id and a.day between p_from and p_to
   where v.clerk_user_id = (select auth.jwt() ->> 'sub')
   group by v.id;
$$;

-- Portfolio summary across all of the caller's videos. Unique viewers are
-- de-duplicated across videos (same hashed viewer id), not summed.
create or replace function public.owner_portfolio_summary(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (select id, title from public.published_videos where clerk_user_id = (select auth.jwt() ->> 'sub') and published),
  tot as (
    select coalesce(sum(a.plays), 0) as plays, coalesce(sum(a.cta_clicks), 0) as cta_clicks,
           coalesce(sum(a.call_clicks), 0) as call_clicks, coalesce(sum(a.leads), 0) as leads
      from public.video_analytics_daily a join mine on mine.id = a.video_id where a.day between p_from and p_to),
  uv as (
    select count(distinct vv.viewer_hash) as n from public.video_daily_viewers vv
      join mine on mine.id = vv.video_id where vv.day between p_from and p_to),
  top as (
    select mine.id, mine.title, sum(a.plays) as plays from public.video_analytics_daily a
      join mine on mine.id = a.video_id where a.day between p_from and p_to
     group by mine.id, mine.title having sum(a.plays) > 0 order by sum(a.plays) desc limit 1),
  recent as (
    select count(distinct a.video_id) as n from public.video_analytics_daily a
      join mine on mine.id = a.video_id
     where a.day >= ((now() at time zone 'utc')::date - 7) and a.plays > 0)
  select jsonb_build_object(
    'published_videos', (select count(*) from mine),
    'plays', tot.plays, 'unique_viewers', uv.n, 'cta_clicks', tot.cta_clicks,
    'call_clicks', tot.call_clicks, 'leads', tot.leads,
    'top_video', (select jsonb_build_object('id', id, 'title', title, 'plays', plays) from top),
    'videos_with_recent_engagement', recent.n)
  from tot, uv, recent;
$$;

-- Per-contact totals for personal links (keeps the Share panel table working):
-- legacy events plus the new sessions.
create or replace function public.video_events_by_contact(video_id text)
returns table (contact_id text, views bigint, plays bigint, completes bigint, cta_clicks bigint, leads bigint, last_seen timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select x.contact_id, sum(x.views)::bigint, sum(x.plays)::bigint, sum(x.completes)::bigint,
         sum(x.cta_clicks)::bigint, sum(x.leads)::bigint, max(x.last_seen)
    from (
      select e.contact_id,
             count(*) filter (where e.kind = 'view') as views, count(*) filter (where e.kind = 'play') as plays,
             count(*) filter (where e.kind = 'complete') as completes, count(*) filter (where e.kind = 'cta_click') as cta_clicks,
             count(*) filter (where e.kind = 'lead') as leads, max(e.created_at) as last_seen
        from public.published_video_events e where e.video_id = video_events_by_contact.video_id group by e.contact_id
      union all
      select s.contact_id,
             count(*) filter (where ev.type = 'page_open'), count(*) filter (where ev.type = 'play'),
             count(*) filter (where ev.type = 'complete'), count(*) filter (where ev.type in ('cta_click', 'call_click')),
             count(*) filter (where ev.type = 'lead_submit'), max(ev.created_at)
        from public.video_view_sessions s join public.video_events ev on ev.session_id = s.id
       where s.video_id = video_events_by_contact.video_id group by s.contact_id
    ) x
   group by x.contact_id order by max(x.last_seen) desc;
$$;

-- ---------------------------------------------------------------- privacy / retention
create or replace function public.delete_video_analytics(p_video_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := auth.jwt() ->> 'sub';
  n_sessions integer;
begin
  if me is null or not exists (select 1 from public.published_videos where id = p_video_id and clerk_user_id = me) then
    raise exception 'not_found' using errcode = '42501';
  end if;
  delete from public.video_view_sessions where video_id = p_video_id; -- cascades to events
  get diagnostics n_sessions = row_count;
  delete from public.video_analytics_daily where video_id = p_video_id;
  delete from public.video_daily_viewers where video_id = p_video_id;
  delete from public.published_video_events where video_id = p_video_id;
  update public.published_videos set view_count = 0 where id = p_video_id;
  return jsonb_build_object('ok', true, 'sessions_deleted', n_sessions);
end;
$$;
revoke all on function public.delete_video_analytics(text) from public;
grant execute on function public.delete_video_analytics(text) to anon, authenticated;

-- Raw events/sessions are kept 90 days; daily aggregates are kept.
create or replace function public.prune_video_analytics(p_raw_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare n_s integer; n_v integer;
begin
  delete from public.video_view_sessions where started_at < now() - make_interval(days => greatest(p_raw_days, 7));
  get diagnostics n_s = row_count;
  delete from public.video_daily_viewers where day < ((now() at time zone 'utc')::date - 400);
  get diagnostics n_v = row_count;
  return jsonb_build_object('sessions_pruned', n_s, 'viewer_days_pruned', n_v);
end;
$$;
revoke all on function public.prune_video_analytics(integer) from public, anon, authenticated;
grant execute on function public.prune_video_analytics(integer) to service_role;

revoke all on function public.video_analytics_summary(text, date, date) from public;
revoke all on function public.video_analytics_timeseries(text, date, date) from public;
revoke all on function public.video_retention_curve(text, date, date) from public;
revoke all on function public.video_section_engagement(text, jsonb, date, date) from public;
revoke all on function public.video_cta_performance(text, date, date) from public;
revoke all on function public.owner_video_stats(date, date) from public;
revoke all on function public.owner_portfolio_summary(date, date) from public;
grant execute on function public.video_analytics_summary(text, date, date) to anon, authenticated;
grant execute on function public.video_analytics_timeseries(text, date, date) to anon, authenticated;
grant execute on function public.video_retention_curve(text, date, date) to authenticated;
grant execute on function public.video_section_engagement(text, jsonb, date, date) to authenticated;
grant execute on function public.video_cta_performance(text, date, date) to anon, authenticated;
grant execute on function public.owner_video_stats(date, date) to anon, authenticated;
grant execute on function public.owner_portfolio_summary(date, date) to anon, authenticated;

-- Nightly prune when pg_cron exists (skipped, not failed, where it does not).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('prune-video-analytics', '17 3 * * *', 'select public.prune_video_analytics(90)');
  end if;
end $$;
