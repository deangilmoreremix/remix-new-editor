-- Audience breakdown, version comparison and country capture for first-party video analytics.
--
-- Privacy: only a two-letter ISO country code is stored (derived by the Netlify function from the CDN geo header).
-- No IP address, city or region is stored. Everything below is additive; nothing is applied to a live project from code.
--
-- 1. video_view_sessions.country_code (nullable, ^[A-Z]{2}$)
-- 2. ingest_video_events(): same body as before plus an optional p_country (default null). The old 7-argument
--    function is dropped and replaced by the 8-argument one, so callers that omit p_country keep working.
-- 3. owner_video_audience_breakdown(): referrer / device / country counts for one video (SECURITY INVOKER, RLS).
-- 4. owner_video_revision_comparison(): per-revision plays, completion, % watched and lead / CTA conversion.

alter table public.video_view_sessions
  add column if not exists country_code text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'video_view_sessions_country_code_check') then
    alter table public.video_view_sessions
      add constraint video_view_sessions_country_code_check check (country_code is null or country_code ~ '^[A-Z]{2}$');
  end if;
end $$;

drop function if exists public.ingest_video_events(text, text, text, text, text, text, jsonb);

create or replace function public.ingest_video_events(
  p_video_id text,
  p_session_key text,
  p_viewer_hash text,
  p_contact_id text,
  p_device text,
  p_referrer text,
  p_events jsonb,
  p_country text default null
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
  if p_country is not null then p_country := upper(p_country); end if;
  if p_country is not null and p_country !~ '^[A-Z]{2}$' then p_country := null; end if;

  insert into public.video_view_sessions (video_id, revision, session_key, viewer_hash, contact_id, device_class, referrer_host, country_code, is_return)
  values (
    p_video_id, v.revision, p_session_key, p_viewer_hash, p_contact_id, p_device, p_referrer, p_country,
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

revoke all on function public.ingest_video_events(text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.ingest_video_events(text, text, text, text, text, text, jsonb, text) to service_role;
comment on function public.ingest_video_events(text, text, text, text, text, text, jsonb, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';

-- ---------------------------------------------------------------- owner reads (SECURITY INVOKER: RLS limits rows to the caller's videos)

-- Played sessions in the range grouped by referrer host (null = direct), device class and country code.
-- Top 10 per dimension. A null key means "not recorded" (direct for referrers). Counts are sessions, not people.
create or replace function public.owner_video_audience_breakdown(p_video_id text, p_from date, p_to date)
returns table (dimension text, key text, sessions bigint, completed_sessions bigint, lead_sessions bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with ss as (
    select s.referrer_host, s.device_class, s.country_code, s.completed,
           exists (select 1 from public.video_events e where e.session_id = s.id and e.type = 'lead_submit') as lead
      from public.video_view_sessions s
     where s.video_id = p_video_id and s.played
       and (s.started_at at time zone 'utc')::date between p_from and p_to),
  g as (
    select 'referrer'::text as dimension, referrer_host as key, count(*) as sessions,
           count(*) filter (where completed) as completed_sessions, count(*) filter (where lead) as lead_sessions from ss group by referrer_host
    union all
    select 'device', device_class, count(*), count(*) filter (where completed), count(*) filter (where lead) from ss group by device_class
    union all
    select 'country', country_code, count(*), count(*) filter (where completed), count(*) filter (where lead) from ss group by country_code),
  r as (select g.*, row_number() over (partition by g.dimension order by g.sessions desc, g.key nulls last) as rn from g)
  select r.dimension, r.key, r.sessions, r.completed_sessions, r.lead_sessions from r where r.rn <= 10
   order by r.dimension, r.sessions desc, r.key nulls last;
$$;

-- One row per published revision that has played sessions in the range, oldest first.
-- avg_percent_watched is 0..1 (same scale as video_analytics_summary); cta_sessions counts sessions with any CTA / call /
-- product / overlay click.
create or replace function public.owner_video_revision_comparison(p_video_id text, p_from date, p_to date)
returns table (revision integer, plays bigint, completed_sessions bigint, completion_rate numeric, avg_percent_watched numeric,
               lead_sessions bigint, cta_sessions bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  with ss as (
    select s.revision, s.completed, s.max_progress,
           exists (select 1 from public.video_events e where e.session_id = s.id and e.type = 'lead_submit') as lead,
           exists (select 1 from public.video_events e where e.session_id = s.id
                    and e.type in ('cta_click', 'call_click', 'product_select', 'overlay_click')) as cta
      from public.video_view_sessions s
     where s.video_id = p_video_id and s.played
       and (s.started_at at time zone 'utc')::date between p_from and p_to)
  select ss.revision, count(*)::bigint, (count(*) filter (where ss.completed))::bigint,
         round((count(*) filter (where ss.completed))::numeric / count(*), 4),
         round(avg(ss.max_progress), 4),
         (count(*) filter (where ss.lead))::bigint, (count(*) filter (where ss.cta))::bigint
    from ss group by ss.revision order by ss.revision;
$$;

revoke all on function public.owner_video_audience_breakdown(text, date, date) from public, anon;
revoke all on function public.owner_video_revision_comparison(text, date, date) from public, anon;
grant execute on function public.owner_video_audience_breakdown(text, date, date) to authenticated;
grant execute on function public.owner_video_revision_comparison(text, date, date) to authenticated;
