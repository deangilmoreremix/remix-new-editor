-- ===========================================================================
-- heatmap_analytics.sql — Stage 7: click / CTA-impression / scroll-depth / per-second watch analytics
--
-- Builds on 20261112020000_video_analytics.sql. Nothing in the existing tables or in ingest_video_events() changes:
-- the hosted-player function (netlify/functions/video-events.js) calls the NEW writer ingest_video_heat_events()
-- with the same service role, after ingest_video_events() has created the session row.
--
-- Privacy (see docs/stage-7/STAGE_7_REPORT.md):
--   * clicks are stored as normalized coordinates (permille of the watch-page container) plus a CTA id/kind/label
--     when a CTA was hit. No element text, selectors, form values, keystrokes, IPs or pointer movement.
--   * every row hangs off video_view_sessions, so the existing 90-day prune/delete removes it with the session.
--   * owner reads are AGGREGATED RPCs. Below a minimum cohort (5 distinct sessions) they return no distribution.
--
-- Auth convention (same as the 20261112* analytics tables): owner = published_videos.clerk_user_id = JWT `sub`.
-- RLS: owner select only; all writes revoked (service_role bypasses RLS and is the only writer).
-- Idempotent: safe to run twice.
-- ===========================================================================

-- ---------------------------------------------------------------- tables
create table if not exists public.video_heat_sessions (
  session_id uuid primary key references public.video_view_sessions (id) on delete cascade,
  video_id text not null references public.published_videos (id) on delete cascade,
  day date not null,                                   -- UTC day the session started (aligns with other analytics)
  viewport_class text not null default 'desktop' check (viewport_class in ('mobile', 'tablet', 'desktop')),
  vp_set boolean not null default false,
  heat_events integer not null default 0,
  click_count smallint not null default 0,
  max_scroll smallint not null default 0 check (max_scroll between 0 and 100),
  max_sec integer not null default -1,                 -- last (furthest) second index watched; -1 = none
  sec_counts smallint[] not null default '{}',         -- times each second index was played in this session (capped at 3)
  bucket_seconds integer not null default 0,           -- raw seconds credited so far (wall-clock sanity bound)
  last_bucket_seq integer not null default -1
);
create index if not exists video_heat_sessions_video_day_idx on public.video_heat_sessions (video_id, day);

create table if not exists public.video_heat_events (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.video_view_sessions (id) on delete cascade,
  video_id text not null references public.published_videos (id) on delete cascade,
  day date not null,
  seq integer not null,
  type text not null check (type in ('heat_click', 'cta_impression', 'scroll_depth')),
  viewport_class text not null check (viewport_class in ('mobile', 'tablet', 'desktop')),
  x smallint check (x is null or x between 0 and 1000),
  y smallint check (y is null or y between 0 and 1000),
  page_bucket smallint check (page_bucket is null or page_bucket between 1 and 40),
  cta_key text check (cta_key is null or char_length(cta_key) <= 80),
  cta_kind text check (cta_kind is null or cta_kind in
    ('book_call', 'visit_website', 'call_now', 'get_offer', 'contact', 'lead_capture', 'other')),
  cta_label text check (cta_label is null or char_length(cta_label) <= 80),
  scroll_pct smallint check (scroll_pct is null or scroll_pct in (25, 50, 75, 100)),
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);
-- Once per session: an impression per CTA, a milestone per depth.
create unique index if not exists video_heat_events_impression_idx
  on public.video_heat_events (session_id, cta_key) where type = 'cta_impression';
create unique index if not exists video_heat_events_scroll_idx
  on public.video_heat_events (session_id, scroll_pct) where type = 'scroll_depth';
create index if not exists video_heat_events_video_type_day_idx
  on public.video_heat_events (video_id, type, day);

-- Aggregated per-second watch counts per video / day / viewport (NOT per-tick rows).
create table if not exists public.video_watch_seconds (
  video_id text not null references public.published_videos (id) on delete cascade,
  day date not null,
  viewport_class text not null check (viewport_class in ('mobile', 'tablet', 'desktop')),
  sec integer not null check (sec between 0 and 3599),
  viewers integer not null default 0,    -- sessions that watched this second at least once
  replays integer not null default 0,    -- sessions that watched this second at least twice
  primary key (video_id, day, viewport_class, sec)
);

do $$
declare t text;
begin
  foreach t in array array['video_heat_sessions', 'video_heat_events', 'video_watch_seconds']
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

-- ---------------------------------------------------------------- ingest (service role only)
-- p_events: already shaped by the Netlify function. Types: heat_click, cta_impression, scroll_depth, watch_buckets.
--   props: vp (mobile|tablet|desktop), x/y (0..1), pb (page-height bucket 1..40), cta, kind, label, v (scroll %),
--          r ([[firstSecond,lastSecond],...] each second watched once more)
create or replace function public.ingest_video_heat_events(p_video_id text, p_session_key text, p_events jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
  s record;
  h public.video_heat_sessions;
  ev jsonb;
  typ text;
  seqv integer;
  props jsonb;
  accepted integer := 0;
  dups integer := 0;
  n integer;
  vp text;
  xv numeric; yv numeric; pb integer;
  ckey text; ckind text; clabel text; sv integer;
  r jsonb; s0 integer; s1 integer; total integer; sc integer; idx integer; old smallint;
  counts smallint[];
  elapsed numeric; allowed numeric; used integer;
  secs integer[] := '{}'; dvs integer[] := '{}'; drs integer[] := '{}';
  maxsec integer;
  limit_sec integer;
  clicks integer; events_n integer; scroll integer; last_bseq integer; bucket_used integer;
  sess_vp text; vpset boolean;
begin
  select id, (project ->> 'timelineSeconds')::numeric as dur into v
    from public.published_videos where id = p_video_id and published = true;
  if not found then return jsonb_build_object('ok', false, 'error', 'unknown_video'); end if;
  if p_session_key is null or p_session_key !~ '^[A-Za-z0-9_-]{16,64}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_session');
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 25 then
    return jsonb_build_object('ok', false, 'error', 'bad_events');
  end if;
  select id, started_at into s from public.video_view_sessions where video_id = p_video_id and session_key = p_session_key;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;

  insert into public.video_heat_sessions (session_id, video_id, day)
  values (s.id, p_video_id, (s.started_at at time zone 'utc')::date)
  on conflict (session_id) do nothing;
  select * into h from public.video_heat_sessions where session_id = s.id for update;
  clicks := h.click_count; events_n := h.heat_events; scroll := h.max_scroll; counts := h.sec_counts;
  maxsec := h.max_sec; last_bseq := h.last_bucket_seq; bucket_used := h.bucket_seconds;
  sess_vp := h.viewport_class; vpset := h.vp_set;
  limit_sec := case when v.dur is not null and v.dur > 0 then least(3599, ceil(v.dur)::integer + 1) else 3599 end;
  elapsed := extract(epoch from (now() - s.started_at));

  for ev in select value from jsonb_array_elements(p_events) loop
    typ := ev ->> 'type';
    if typ is null or typ not in ('heat_click', 'cta_impression', 'scroll_depth', 'watch_buckets') then
      dups := dups + 1; continue;
    end if;
    if coalesce(ev ->> 'seq', '') !~ '^[0-9]{1,6}$' then dups := dups + 1; continue; end if;
    seqv := (ev ->> 'seq')::integer;
    props := case when jsonb_typeof(ev -> 'props') = 'object' then ev -> 'props' else '{}'::jsonb end;

    -- The session's viewport class is fixed by its first event (so aggregates never split mid-session).
    if not vpset then
      vp := props ->> 'vp';
      sess_vp := case when vp in ('mobile', 'tablet', 'desktop') then vp else 'desktop' end;
      vpset := true;
    end if;

    if typ = 'watch_buckets' then
      if seqv <= last_bseq then dups := dups + 1; continue; end if; -- retried batch
      last_bseq := seqv;
      if jsonb_typeof(props -> 'r') <> 'array' or jsonb_array_length(props -> 'r') > 30 then dups := dups + 1; continue; end if;
      -- validate the whole event first: ranges are [first,last] integers, <= 600 seconds in total
      total := 0;
      for r in select value from jsonb_array_elements(props -> 'r') loop
        if jsonb_typeof(r) <> 'array' or jsonb_array_length(r) <> 2
           or coalesce(r ->> 0, '') !~ '^[0-9]{1,4}$' or coalesce(r ->> 1, '') !~ '^[0-9]{1,4}$' then
          total := -1; exit;
        end if;
        s0 := (r ->> 0)::integer; s1 := (r ->> 1)::integer;
        if s1 < s0 or s1 > limit_sec then total := -1; exit; end if;
        total := total + (s1 - s0 + 1);
      end loop;
      if total <= 0 or total > 600 then dups := dups + 1; continue; end if;
      -- cannot have watched more seconds than the wall-clock time since the session began (+ slack)
      allowed := greatest(0, elapsed * 1.1 + 10 - bucket_used);
      if total > allowed then dups := dups + 1; continue; end if;
      bucket_used := bucket_used + total;
      for r in select value from jsonb_array_elements(props -> 'r') loop
        s0 := (r ->> 0)::integer; s1 := (r ->> 1)::integer;
        for sc in s0..s1 loop
          idx := sc + 1;
          while coalesce(array_length(counts, 1), 0) < idx loop counts := counts || 0::smallint; end loop;
          old := counts[idx];
          counts[idx] := least(3, old + 1)::smallint;
          if old = 0 then secs := secs || sc; dvs := dvs || 1; drs := drs || 0;
          elsif old = 1 then secs := secs || sc; dvs := dvs || 0; drs := drs || 1;
          end if;
          if sc > maxsec then maxsec := sc; end if;
        end loop;
      end loop;
      accepted := accepted + 1;
      continue;
    end if;

    if events_n >= 100 then dups := dups + 1; continue; end if; -- bounded raw rows per session

    if typ = 'heat_click' then
      if clicks >= 30 then dups := dups + 1; continue; end if;
      if coalesce(props ->> 'x', '') !~ '^[01](\.[0-9]{1,4})?$' or coalesce(props ->> 'y', '') !~ '^[01](\.[0-9]{1,4})?$'
         or (props ->> 'x')::numeric > 1 or (props ->> 'y')::numeric > 1 then
        dups := dups + 1; continue;
      end if;
      xv := (props ->> 'x')::numeric; yv := (props ->> 'y')::numeric;
      pb := case when coalesce(props ->> 'pb', '') ~ '^[0-9]{1,2}$' and (props ->> 'pb')::integer between 1 and 40
                 then (props ->> 'pb')::integer else 1 end;
      ckey := nullif(left(props ->> 'cta', 80), '');
      ckind := case when props ->> 'kind' in ('book_call', 'visit_website', 'call_now', 'get_offer', 'contact', 'lead_capture', 'other')
                    then props ->> 'kind' end;
      clabel := nullif(left(props ->> 'label', 80), '');
      insert into public.video_heat_events (session_id, video_id, day, seq, type, viewport_class, x, y, page_bucket, cta_key, cta_kind, cta_label)
      values (s.id, p_video_id, h.day, seqv, 'heat_click', sess_vp, round(xv * 1000)::smallint, round(yv * 1000)::smallint, pb::smallint,
              ckey, case when ckey is not null then coalesce(ckind, 'other') end, case when ckey is not null then clabel end)
      on conflict do nothing;
      get diagnostics n = row_count;
      if n = 0 then dups := dups + 1; continue; end if;
      clicks := clicks + 1;
    elsif typ = 'cta_impression' then
      ckey := nullif(left(props ->> 'cta', 80), '');
      if ckey is null then dups := dups + 1; continue; end if;
      ckind := coalesce(case when props ->> 'kind' in ('book_call', 'visit_website', 'call_now', 'get_offer', 'contact', 'lead_capture', 'other')
                             then props ->> 'kind' end, 'other');
      clabel := nullif(left(props ->> 'label', 80), '');
      insert into public.video_heat_events (session_id, video_id, day, seq, type, viewport_class, cta_key, cta_kind, cta_label)
      values (s.id, p_video_id, h.day, seqv, 'cta_impression', sess_vp, ckey, ckind, clabel)
      on conflict do nothing;
      get diagnostics n = row_count;
      if n = 0 then dups := dups + 1; continue; end if;
    else -- scroll_depth
      if props ->> 'v' not in ('25', '50', '75', '100') then dups := dups + 1; continue; end if;
      sv := (props ->> 'v')::integer;
      insert into public.video_heat_events (session_id, video_id, day, seq, type, viewport_class, scroll_pct)
      values (s.id, p_video_id, h.day, seqv, 'scroll_depth', sess_vp, sv::smallint)
      on conflict do nothing;
      get diagnostics n = row_count;
      if n = 0 then dups := dups + 1; continue; end if;
      scroll := greatest(scroll, sv);
    end if;
    accepted := accepted + 1;
    events_n := events_n + 1;
  end loop;

  update public.video_heat_sessions
     set viewport_class = sess_vp, vp_set = vpset, heat_events = events_n, click_count = clicks::smallint,
         max_scroll = scroll::smallint, max_sec = maxsec, sec_counts = counts, bucket_seconds = bucket_used,
         last_bucket_seq = last_bseq
   where session_id = s.id;

  if coalesce(array_length(secs, 1), 0) > 0 then
    insert into public.video_watch_seconds (video_id, day, viewport_class, sec, viewers, replays)
    select p_video_id, h.day, sess_vp, g.sec, sum(g.dv)::integer, sum(g.dr)::integer
      from unnest(secs, dvs, drs) as g(sec, dv, dr) group by g.sec
    on conflict (video_id, day, viewport_class, sec) do update
      set viewers = public.video_watch_seconds.viewers + excluded.viewers,
          replays = public.video_watch_seconds.replays + excluded.replays;
  end if;

  return jsonb_build_object('ok', true, 'accepted', accepted, 'duplicates', dups);
end;
$$;
revoke all on function public.ingest_video_heat_events(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_video_heat_events(text, text, jsonb) to service_role;

-- ---------------------------------------------------------------- owner reads (aggregated, cohort-protected)
-- SECURITY DEFINER with an explicit ownership check (same pattern as delete_video_analytics): a caller who is not the
-- owner of p_video_id gets 42501 and nothing else. Below the minimum cohort no distribution is returned.
create or replace function public._heat_min_cohort() returns integer
language sql immutable set search_path = '' as $$ select 5 $$;

create or replace function public._heat_assert_owner(p_video_id text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare me text := auth.jwt() ->> 'sub';
begin
  if me is null or not exists (select 1 from public.published_videos where id = p_video_id and clerk_user_id = me) then
    raise exception 'not_found' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public._heat_assert_owner(text) from public, anon, authenticated;

-- Click heatmap: 50x50 grid cells over the normalized container. p_viewport/p_cta/p_page_bucket are optional filters.
create or replace function public.video_heat_clicks(
  p_video_id text, p_from date, p_to date,
  p_viewport text default null, p_cta text default null, p_page_bucket integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  sess integer; total integer; cells jsonb; buckets jsonb; top_bucket integer;
begin
  perform public._heat_assert_owner(p_video_id);
  select count(distinct e.session_id), count(*) into sess, total
    from public.video_heat_events e
   where e.video_id = p_video_id and e.type = 'heat_click' and e.day between p_from and p_to
     and (p_viewport is null or e.viewport_class = p_viewport)
     and (p_cta is null or e.cta_key = p_cta)
     and (p_page_bucket is null or e.page_bucket = p_page_bucket);
  if sess < public._heat_min_cohort() then
    return jsonb_build_object('suppressed', true, 'min_cohort', public._heat_min_cohort(), 'sessions', sess);
  end if;
  select coalesce(jsonb_agg(jsonb_build_array(c.cx, c.cy, c.n) order by c.cy, c.cx), '[]'::jsonb) into cells from (
    select least(49, e.x / 20) as cx, least(49, e.y / 20) as cy, count(*) as n
      from public.video_heat_events e
     where e.video_id = p_video_id and e.type = 'heat_click' and e.day between p_from and p_to
       and (p_viewport is null or e.viewport_class = p_viewport)
       and (p_cta is null or e.cta_key = p_cta)
       and (p_page_bucket is null or e.page_bucket = p_page_bucket)
     group by 1, 2) c;
  select coalesce(jsonb_agg(jsonb_build_object('page_bucket', b.page_bucket, 'clicks', b.n) order by b.n desc), '[]'::jsonb) into buckets from (
    select e.page_bucket, count(*) as n from public.video_heat_events e
     where e.video_id = p_video_id and e.type = 'heat_click' and e.day between p_from and p_to
       and (p_viewport is null or e.viewport_class = p_viewport) and (p_cta is null or e.cta_key = p_cta)
     group by 1) b;
  return jsonb_build_object('suppressed', false, 'min_cohort', public._heat_min_cohort(), 'sessions', sess,
                            'clicks', total, 'grid', 50, 'cells', cells, 'page_buckets', buckets);
end;
$$;

-- CTA table: impressions (distinct sessions that saw the CTA >= 50% visible) vs clicks (distinct sessions that used it).
-- A CTR is only returned when the CTA has impressions (never fabricated for old data without them).
create or replace function public.video_heat_cta_stats(p_video_id text, p_from date, p_to date, p_viewport text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare out jsonb; sess integer;
begin
  perform public._heat_assert_owner(p_video_id);
  select count(*) into sess from public.video_heat_sessions hs
   where hs.video_id = p_video_id and hs.day between p_from and p_to and (p_viewport is null or hs.viewport_class = p_viewport);
  with imp as (
    select e.cta_key, max(e.cta_kind) as kind, max(e.cta_label) as label, count(distinct e.session_id) as impressions
      from public.video_heat_events e
     where e.video_id = p_video_id and e.type = 'cta_impression' and e.day between p_from and p_to
       and (p_viewport is null or e.viewport_class = p_viewport)
     group by e.cta_key),
  clk as (
    select ve.clip_id as cta_key, max(ve.props ->> 'label') as label, count(distinct ve.session_id) as clicks
      from public.video_events ve
      join public.video_view_sessions vs on vs.id = ve.session_id
      left join public.video_heat_sessions hs on hs.session_id = ve.session_id
     where ve.video_id = p_video_id and ve.type in ('cta_click', 'call_click', 'lead_submit') and ve.clip_id is not null
       and (vs.started_at at time zone 'utc')::date between p_from and p_to
       and (p_viewport is null or hs.viewport_class = p_viewport)
     group by ve.clip_id)
  select coalesce(jsonb_agg(jsonb_build_object(
           'cta_key', k.cta_key, 'kind', coalesce(k.kind, 'other'), 'label', k.label,
           'suppressed', coalesce(k.impressions, 0) < public._heat_min_cohort() and k.impressions is not null,
           'impressions', case when k.impressions >= public._heat_min_cohort() then k.impressions end,
           'clicks', case when k.impressions is null or k.impressions >= public._heat_min_cohort() then k.clicks end,
           'ctr', case when k.impressions >= public._heat_min_cohort() and k.clicks is not null
                       then round(least(k.clicks, k.impressions)::numeric / k.impressions, 4) end)
         order by k.impressions desc nulls last, k.clicks desc nulls last), '[]'::jsonb) into out
    from (
      select coalesce(i.cta_key, c.cta_key) as cta_key, i.kind, coalesce(i.label, c.label) as label,
             i.impressions, coalesce(c.clicks, case when i.impressions is not null then 0 end) as clicks
        from imp i full join clk c on c.cta_key = i.cta_key
       limit 100) k;
  return jsonb_build_object('min_cohort', public._heat_min_cohort(), 'sessions', sess, 'ctas', out);
end;
$$;

-- Scroll depth distribution + CTA exposure. Denominator = sessions that reported anything from the page.
create or replace function public.video_heat_scroll(p_video_id text, p_from date, p_to date, p_viewport text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare sess integer; r25 integer; r50 integer; r75 integer; r100 integer; cta_seen integer;
begin
  perform public._heat_assert_owner(p_video_id);
  select count(*), count(*) filter (where max_scroll >= 25), count(*) filter (where max_scroll >= 50),
         count(*) filter (where max_scroll >= 75), count(*) filter (where max_scroll >= 100)
    into sess, r25, r50, r75, r100
    from public.video_heat_sessions
   where video_id = p_video_id and day between p_from and p_to and (p_viewport is null or viewport_class = p_viewport);
  if sess < public._heat_min_cohort() then
    return jsonb_build_object('suppressed', true, 'min_cohort', public._heat_min_cohort(), 'sessions', sess);
  end if;
  select count(distinct e.session_id) into cta_seen from public.video_heat_events e
   where e.video_id = p_video_id and e.type = 'cta_impression' and e.day between p_from and p_to
     and (p_viewport is null or e.viewport_class = p_viewport);
  return jsonb_build_object('suppressed', false, 'min_cohort', public._heat_min_cohort(), 'sessions', sess,
    'reached', jsonb_build_object('25', r25, '50', r50, '75', r75, '100', r100),
    'cta_exposed_sessions', cta_seen);
end;
$$;

-- Per-second engagement: viewers / replays / skips / drop-off per second index.
--   skips(sec)   = sessions that watched later but not this second
--   dropoff(sec) = sessions whose furthest watched second is this one
create or replace function public.video_heat_engagement(p_video_id text, p_from date, p_to date, p_viewport text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare sess integer; dur numeric; top_sec integer; out jsonb;
begin
  perform public._heat_assert_owner(p_video_id);
  select (project ->> 'timelineSeconds')::numeric into dur from public.published_videos where id = p_video_id;
  select count(*), coalesce(max(max_sec), -1) into sess, top_sec
    from public.video_heat_sessions
   where video_id = p_video_id and day between p_from and p_to and max_sec >= 0
     and (p_viewport is null or viewport_class = p_viewport);
  if sess < public._heat_min_cohort() then
    return jsonb_build_object('suppressed', true, 'min_cohort', public._heat_min_cohort(), 'sessions', sess, 'duration_s', dur);
  end if;
  with ends as (
    select max_sec as sec, count(*) as d from public.video_heat_sessions
     where video_id = p_video_id and day between p_from and p_to and max_sec >= 0
       and (p_viewport is null or viewport_class = p_viewport)
     group by max_sec),
  agg as (
    select sec, sum(viewers) as viewers, sum(replays) as replays from public.video_watch_seconds
     where video_id = p_video_id and day between p_from and p_to and (p_viewport is null or viewport_class = p_viewport)
     group by sec),
  g as (
    select gs as sec, coalesce(a.viewers, 0) as viewers, coalesce(a.replays, 0) as replays, coalesce(e.d, 0) as d
      from generate_series(0, top_sec) gs left join agg a on a.sec = gs left join ends e on e.sec = gs),
  w as (
    select sec, viewers, replays, d,
           coalesce(sum(d) over (order by sec desc rows between unbounded preceding and 1 preceding), 0) as later
      from g)
  select jsonb_build_object(
      'viewers', jsonb_agg(viewers order by sec), 'replays', jsonb_agg(replays order by sec),
      'dropoff', jsonb_agg(d order by sec),
      'skips', jsonb_agg(greatest(0, later - viewers + d) order by sec)) into out
    from w;
  return jsonb_build_object('suppressed', false, 'min_cohort', public._heat_min_cohort(), 'sessions', sess,
                            'duration_s', dur, 'seconds', out);
end;
$$;

revoke all on function public.video_heat_clicks(text, date, date, text, text, integer) from public;
revoke all on function public.video_heat_cta_stats(text, date, date, text) from public;
revoke all on function public.video_heat_scroll(text, date, date, text) from public;
revoke all on function public.video_heat_engagement(text, date, date, text) from public;
grant execute on function public.video_heat_clicks(text, date, date, text, text, integer) to anon, authenticated;
grant execute on function public.video_heat_cta_stats(text, date, date, text) to anon, authenticated;
grant execute on function public.video_heat_scroll(text, date, date, text) to anon, authenticated;
grant execute on function public.video_heat_engagement(text, date, date, text) to anon, authenticated;

-- ---------------------------------------------------------------- retention (90 days, like the raw analytics)
-- video_heat_sessions / video_heat_events cascade from video_view_sessions (pruned at 90 days). video_watch_seconds is
-- keyed by day, so it is pruned explicitly here. Existing behaviour is kept; the new delete is the only addition.
create or replace function public.prune_video_analytics(p_raw_days integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare n_s integer; n_v integer; n_w integer;
begin
  delete from public.video_view_sessions where started_at < now() - make_interval(days => greatest(p_raw_days, 7));
  get diagnostics n_s = row_count;
  delete from public.video_daily_viewers where day < ((now() at time zone 'utc')::date - 400);
  get diagnostics n_v = row_count;
  delete from public.video_watch_seconds
   where day < ((now() at time zone 'utc')::date - greatest(p_raw_days, 7));
  get diagnostics n_w = row_count;
  return jsonb_build_object('sessions_pruned', n_s, 'viewer_days_pruned', n_v, 'watch_second_rows_pruned', n_w);
end;
$$;
revoke all on function public.prune_video_analytics(integer) from public, anon, authenticated;
grant execute on function public.prune_video_analytics(integer) to service_role;

-- Owner "delete analytics" also clears the per-second aggregates (sessions cascade to heat sessions/events).
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
  delete from public.video_view_sessions where video_id = p_video_id; -- cascades to events, heat sessions, heat events
  get diagnostics n_sessions = row_count;
  delete from public.video_analytics_daily where video_id = p_video_id;
  delete from public.video_daily_viewers where video_id = p_video_id;
  delete from public.video_watch_seconds where video_id = p_video_id;
  delete from public.published_video_events where video_id = p_video_id;
  update public.published_videos set view_count = 0 where id = p_video_id;
  return jsonb_build_object('ok', true, 'sessions_deleted', n_sessions);
end;
$$;
revoke all on function public.delete_video_analytics(text) from public;
grant execute on function public.delete_video_analytics(text) to anon, authenticated;

-- ---------------------------------------------------------------- labels (same convention as 20261112040000)
comment on table public.video_heat_sessions is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: per-session heatmap aggregates (viewport, scroll, per-second counts); pruned with the session at 90 days.';
comment on table public.video_heat_events is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: normalized click coordinates, CTA impressions and scroll milestones (no text, no pointer movement); pruned at 90 days.';
comment on table public.video_watch_seconds is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: aggregated per-second watch counts per video/day/viewport; pruned at 90 days.';
comment on function public.ingest_video_heat_events(text, text, jsonb) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_clicks(text, date, date, text, text, integer) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_cta_stats(text, date, date, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_scroll(text, date, date, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_engagement(text, date, date, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
