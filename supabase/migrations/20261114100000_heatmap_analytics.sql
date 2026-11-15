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
--   * owner reads are AGGREGATED RPCs with small-cell suppression: the view needs K sessions AND every displayed cell K distinct
--     sessions (cells are merged / withheld otherwise; no complementary disclosure). See the rules above video_heat_clicks().
--   * hardening-safe: explicit grants only, REVOKE from public/anon on every function, no reliance on default privileges.
--
-- Auth convention (same as the 20261112* analytics tables): owner = published_videos.clerk_user_id = JWT `sub`.
-- RLS: enabled, deny by default (no client policy/grant; see below). Writer: ingest_video_heat_events (service_role only).
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

-- RLS is ENABLED on every new table and no client role gets any table privilege or policy: deny by default, with nothing
-- depending on Supabase default privileges (which the live project has revoked for new tables). Owners read ONLY through the
-- aggregated, small-cell-protected RPCs below; a direct SELECT on the raw rows (per-session x/y, CTA, second counts) would
-- bypass the cohort rules, which is why these tables, unlike the 20261112* ones, have no owner SELECT policy. The writer
-- (ingest_video_heat_events) and the owner RPCs are SECURITY DEFINER functions owned by the migration role, so they need no
-- table grants for service_role / authenticated either.
do $$
declare t text;
begin
  foreach t in array array['video_heat_sessions', 'video_heat_events', 'video_watch_seconds']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Owners read own video analytics" on public.%I', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
revoke all on sequence public.video_heat_events_id_seq from public, anon, authenticated;

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

-- ---------------------------------------------------------------- owner reads (aggregated, small-cell protected)
-- SECURITY DEFINER with an explicit ownership check (same pattern as delete_video_analytics): a caller who is not the
-- owner of p_video_id gets 42501 and nothing else.
--
-- Privacy rules (the threshold K lives ONLY in _heat_min_cohort(); every RPC reads it from there):
--   1. View level: fewer than K distinct sessions in the filtered view => {suppressed:true}, no distribution.
--   2. Cell level: every displayed non-zero count is based on >= K DISTINCT SESSIONS. A cell/bucket below K is never shown;
--      it is merged into a coarser cell or an "other" pool, and the pool itself is shown only if it reaches K sessions.
--   3. Complementary disclosure: no total is returned that includes withheld cells (totals are sums of DISPLAYED cells, so a
--      withheld value cannot be recovered by subtracting displayed cells from a displayed total), and partitions of the
--      sessions (scroll bands, drop-off bins) are merged until each part is >= K, so no part can be derived by subtraction.
--      A withheld cell is signalled only by a boolean ("withheld"/"suppressed"), never by a count or a position.
--   Residual risk (documented in docs/stage-10/FIX_F_REPORT.md): differencing across OVERLAPPING filters / date ranges
--   (e.g. the same view for 7 and 8 days) is not prevented.
create or replace function public._heat_min_cohort() returns integer
language sql immutable set search_path = '' as $$ select 5 $$;

-- A count may be displayed when it is zero (nobody) or at least K.
create or replace function public._heat_ok(n numeric) returns boolean
language sql immutable set search_path = '' as $$ select n = 0 or n >= public._heat_min_cohort() $$;

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
revoke all on function public._heat_min_cohort() from public, anon, authenticated, service_role;
revoke all on function public._heat_ok(numeric) from public, anon, authenticated, service_role;
revoke all on function public._heat_assert_owner(text) from public, anon, authenticated, service_role;

-- Click heatmap. Fine cells (50x50 grid) with >= K distinct sessions are returned as they are. Events in the other fine cells
-- are merged into 10x10 blocks (5x5 fine cells); a block is returned if the merged events come from >= K sessions. What is
-- left forms one "other" pool, returned only if it has >= K sessions, otherwise only "withheld": true.
-- cells/coarse/other are disjoint, "clicks" = sum of what is returned.
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
  k integer := public._heat_min_cohort();
  sess integer; res jsonb;
begin
  perform public._heat_assert_owner(p_video_id);
  select count(distinct e.session_id) into sess
    from public.video_heat_events e
   where e.video_id = p_video_id and e.type = 'heat_click' and e.day between p_from and p_to
     and (p_viewport is null or e.viewport_class = p_viewport)
     and (p_cta is null or e.cta_key = p_cta)
     and (p_page_bucket is null or e.page_bucket = p_page_bucket);
  if sess < k then
    return jsonb_build_object('suppressed', true, 'min_cohort', k, 'sessions', sess);
  end if;
  with evp as (
    select e.session_id as sid, least(49, e.x / 20) as cx, least(49, e.y / 20) as cy, e.page_bucket as pb, e.cta_key
      from public.video_heat_events e
     where e.video_id = p_video_id and e.type = 'heat_click' and e.day between p_from and p_to
       and (p_viewport is null or e.viewport_class = p_viewport)),
  ev as (select * from evp where (p_cta is null or cta_key = p_cta) and (p_page_bucket is null or pb = p_page_bucket)),
  fine as (select cx, cy, count(distinct sid) as s, count(*) as n from ev group by cx, cy),
  rest as (select ev.sid, ev.cx, ev.cy from ev join fine f on f.cx = ev.cx and f.cy = ev.cy where f.s < k),
  blk as (select cx / 5 as bx, cy / 5 as bj, count(distinct sid) as s, count(*) as n from rest group by 1, 2),
  oth as (select count(distinct r.sid) as s, count(*) as n
            from rest r join blk b on b.bx = r.cx / 5 and b.bj = r.cy / 5 where b.s < k),
  pbs as (select pb, count(distinct sid) as s, count(*) as n from evp group by pb),
  pbo as (select count(distinct p.sid) as s, count(*) as n from evp p join pbs b on b.pb = p.pb where b.s < k)
  select jsonb_build_object(
    'suppressed', false, 'min_cohort', k, 'sessions', sess,
    'clicks', coalesce((select sum(n) from fine where s >= k), 0) + coalesce((select sum(n) from blk where s >= k), 0)
              + coalesce((select n from oth where s >= k), 0),
    'grid', 50, 'coarse_grid', 10,
    'cells', coalesce((select jsonb_agg(jsonb_build_array(cx, cy, n) order by cy, cx) from fine where s >= k), '[]'::jsonb),
    'coarse', coalesce((select jsonb_agg(jsonb_build_array(bx, bj, n) order by bj, bx) from blk where s >= k), '[]'::jsonb),
    'other', (select jsonb_build_object('sessions', s, 'clicks', n) from oth where s >= k),
    'withheld', (select s > 0 and s < k from oth),
    'page_buckets', coalesce((select jsonb_agg(jsonb_build_object('page_bucket', pb, 'clicks', n) order by n desc) from pbs where s >= k), '[]'::jsonb),
    'page_buckets_other', (select jsonb_build_object('sessions', s, 'clicks', n) from pbo where s >= k)
  ) into res;
  return res;
end;
$$;

-- CTA table: impressions (distinct sessions that saw the CTA >= 50% visible) vs clicks (distinct sessions that used it).
-- impressions < K  => the row is "suppressed" (no numbers).  clicks in 1..K-1 => clicks_suppressed (no number, no CTR).
-- A CTR is only returned when both numbers are displayed and impressions exist (never fabricated for old data).
-- No total row exists, so there is nothing to subtract from.
create or replace function public.video_heat_cta_stats(p_video_id text, p_from date, p_to date, p_viewport text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare out jsonb; sess integer; k integer := public._heat_min_cohort();
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
     group by ve.clip_id),
  j as (
    select coalesce(i.cta_key, c.cta_key) as cta_key, i.kind, coalesce(i.label, c.label) as label,
           i.impressions, coalesce(c.clicks, case when i.impressions is not null then 0 end) as clicks
      from imp i full join clk c on c.cta_key = i.cta_key
     limit 100),
  d as (
    select j.*,
           (j.impressions is not null and j.impressions < k) as imp_hidden,
           (j.clicks is not null and not (j.impressions is not null and j.impressions < k) and public._heat_ok(j.clicks)) as clk_shown
      from j)
  select coalesce(jsonb_agg(jsonb_build_object(
           'cta_key', d.cta_key, 'kind', coalesce(d.kind, 'other'), 'label', d.label,
           'suppressed', d.imp_hidden,
           'impressions', case when not d.imp_hidden then d.impressions end,
           'clicks', case when d.clk_shown then d.clicks end,
           'clicks_suppressed', d.clicks is not null and not d.clk_shown,
           'ctr', case when d.clk_shown and d.impressions >= k then round(least(d.clicks, d.impressions)::numeric / d.impressions, 4) end)
         order by d.impressions desc nulls last, d.clicks desc nulls last), '[]'::jsonb) into out
    from d;
  return jsonb_build_object('min_cohort', k, 'sessions', sess, 'ctas', out);
end;
$$;

-- Scroll depth. The sessions fall into 5 disjoint bands by deepest milestone (none, 25, 50, 75, 100). A band is displayed only
-- through "reached" values that are sums of whole groups of bands, and groups are merged (a small band joins its deeper
-- neighbour) until each group has >= K sessions (or is empty), so no band can be derived by subtracting two displayed values.
-- reached[m] is null when depth m falls inside a merged group.
create or replace function public.video_heat_scroll(p_video_id text, p_from date, p_to date, p_viewport text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k integer := public._heat_min_cohort();
  sess integer; r25 integer; r50 integer; r75 integer; r100 integer; cta_seen integer;
  b integer[]; starts boolean[] := array[false, false, false, false, false];
  acc integer := 0; lowest_real integer := 6; i integer; j integer; nxt integer; tot integer;
  reached jsonb := '{}'::jsonb; bands jsonb := '[]'::jsonb;
begin
  perform public._heat_assert_owner(p_video_id);
  select count(*), count(*) filter (where max_scroll >= 25), count(*) filter (where max_scroll >= 50),
         count(*) filter (where max_scroll >= 75), count(*) filter (where max_scroll >= 100)
    into sess, r25, r50, r75, r100
    from public.video_heat_sessions
   where video_id = p_video_id and day between p_from and p_to and (p_viewport is null or viewport_class = p_viewport);
  if sess < k then
    return jsonb_build_object('suppressed', true, 'min_cohort', k, 'sessions', sess);
  end if;
  b := array[sess - r25, r25 - r50, r50 - r75, r75 - r100, r100];   -- bands idx 1..5 = depth 0, 25, 50, 75, 100
  for i in reverse 5..1 loop
    acc := acc + b[i];
    if acc >= k then starts[i] := true; lowest_real := i; acc := 0;
    elsif acc = 0 then starts[i] := true;                            -- an empty band is safe to show on its own
    end if;
  end loop;
  if acc > 0 then                                                    -- leftover < K joins the deepest-side group(s) next to it
    for j in 2..lowest_real loop starts[j] := false; end loop;
    starts[1] := true;
  end if;
  for i in 2..5 loop
    tot := 0;
    for j in i..5 loop tot := tot + b[j]; end loop;
    reached := reached || jsonb_build_object(((i - 1) * 25)::text, case when starts[i] then to_jsonb(tot) else 'null'::jsonb end);
  end loop;
  for i in 1..5 loop
    if starts[i] then
      nxt := 6;
      for j in i + 1..5 loop if starts[j] then nxt := j; exit; end if; end loop;
      tot := 0;
      for j in i..nxt - 1 loop tot := tot + b[j]; end loop;
      bands := bands || jsonb_build_array(jsonb_build_object('from', (i - 1) * 25, 'sessions', tot));
    end if;
  end loop;
  select count(distinct e.session_id) into cta_seen from public.video_heat_events e
   where e.video_id = p_video_id and e.type = 'cta_impression' and e.day between p_from and p_to
     and (p_viewport is null or e.viewport_class = p_viewport);
  return jsonb_build_object('suppressed', false, 'min_cohort', k, 'sessions', sess,
    'reached', reached, 'bands', bands,
    -- both "saw a CTA" and "saw none" are cells of the same partition: shown only if each is zero or >= K
    'cta_exposed_sessions', case when public._heat_ok(cta_seen) and public._heat_ok(sess - cta_seen) then to_jsonb(cta_seen) end);
end;
$$;

-- Per-second engagement: viewers / replays / skips per second index, drop-off in bins.
--   skips(sec) = sessions that watched later but not this second
--   drop-off   = sessions whose furthest watched second falls in the bin; bins are consecutive second ranges merged until
--                each holds >= K sessions (so the bins partition all sessions and no bin can be derived by subtraction)
-- A per-second value of 1..K-1 is null (withheld); 0 is shown. The series ends at the last second watched by >= K viewers
-- (the length of the series never reveals how far one single viewer got).
create or replace function public.video_heat_engagement(p_video_id text, p_from date, p_to date, p_viewport text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k integer := public._heat_min_cohort();
  sess integer; dur numeric; cut integer; out jsonb; dv integer[];
  acc integer := 0; st integer := 0; i integer;
  bfrom integer[] := '{}'; bto integer[] := '{}'; bn integer[] := '{}'; bins jsonb := '[]'::jsonb;
begin
  perform public._heat_assert_owner(p_video_id);
  select (project ->> 'timelineSeconds')::numeric into dur from public.published_videos where id = p_video_id;
  select count(*) into sess
    from public.video_heat_sessions
   where video_id = p_video_id and day between p_from and p_to and max_sec >= 0
     and (p_viewport is null or viewport_class = p_viewport);
  if sess < k then
    return jsonb_build_object('suppressed', true, 'min_cohort', k, 'sessions', sess, 'duration_s', dur);
  end if;
  select coalesce(max(sec), -1) into cut from (
    select sec from public.video_watch_seconds
     where video_id = p_video_id and day between p_from and p_to and (p_viewport is null or viewport_class = p_viewport)
     group by sec having sum(viewers) >= k) q;
  if cut < 0 then
    return jsonb_build_object('suppressed', false, 'min_cohort', k, 'sessions', sess, 'duration_s', dur,
      'seconds', jsonb_build_object('viewers', '[]'::jsonb, 'replays', '[]'::jsonb, 'skips', '[]'::jsonb, 'dropoff_bins', '[]'::jsonb));
  end if;
  with ends as (
    select least(max_sec, cut) as sec, count(*) as d from public.video_heat_sessions
     where video_id = p_video_id and day between p_from and p_to and max_sec >= 0
       and (p_viewport is null or viewport_class = p_viewport)
     group by 1),
  agg as (
    select sec, sum(viewers) as viewers, sum(replays) as replays from public.video_watch_seconds
     where video_id = p_video_id and day between p_from and p_to and (p_viewport is null or viewport_class = p_viewport)
     group by sec),
  g as (
    select gs as sec, coalesce(a.viewers, 0) as viewers, coalesce(a.replays, 0) as replays, coalesce(e.d, 0) as d
      from generate_series(0, cut) gs left join agg a on a.sec = gs left join ends e on e.sec = gs),
  w as (
    select sec, viewers, replays, d,
           coalesce(sum(d) over (order by sec desc rows between unbounded preceding and 1 preceding), 0) as later
      from g)
  select jsonb_build_object(
      'viewers', jsonb_agg(case when public._heat_ok(viewers) then viewers end order by sec),
      'replays', jsonb_agg(case when public._heat_ok(replays) then replays end order by sec),
      'skips', jsonb_agg(case when public._heat_ok(greatest(0, later - viewers + d)) then greatest(0, later - viewers + d) end order by sec)),
      array_agg(d::integer order by sec)
    into out, dv
    from w;
  for i in 0..cut loop
    acc := acc + dv[i + 1];
    if acc >= k then bfrom := bfrom || st; bto := bto || i; bn := bn || acc; st := i + 1; acc := 0; end if;
  end loop;
  if st <= cut then                                                  -- leftover seconds (< K sessions, maybe none) join the last bin
    bto[array_length(bto, 1)] := cut;
    bn[array_length(bn, 1)] := bn[array_length(bn, 1)] + acc;
  end if;
  for i in 1..coalesce(array_length(bfrom, 1), 0) loop
    bins := bins || jsonb_build_array(jsonb_build_array(bfrom[i], bto[i], bn[i]));
  end loop;
  return jsonb_build_object('suppressed', false, 'min_cohort', k, 'sessions', sess,
                            'duration_s', dur, 'seconds', out || jsonb_build_object('dropoff_bins', bins));
end;
$$;

revoke all on function public.video_heat_clicks(text, date, date, text, text, integer) from public, anon, authenticated, service_role;
revoke all on function public.video_heat_cta_stats(text, date, date, text) from public, anon, authenticated, service_role;
revoke all on function public.video_heat_scroll(text, date, date, text) from public, anon, authenticated, service_role;
revoke all on function public.video_heat_engagement(text, date, date, text) from public, anon, authenticated, service_role;
-- explicit revokes above also cover Supabase's default grants to service_role: the deployed ACLs are identical with or without them
grant execute on function public.video_heat_clicks(text, date, date, text, text, integer) to authenticated;
grant execute on function public.video_heat_cta_stats(text, date, date, text) to authenticated;
grant execute on function public.video_heat_scroll(text, date, date, text) to authenticated;
grant execute on function public.video_heat_engagement(text, date, date, text) to authenticated;

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
revoke all on function public.delete_video_analytics(text) from public, anon, authenticated;
grant execute on function public.delete_video_analytics(text) to authenticated;

-- ---------------------------------------------------------------- labels (same convention as 20261112040000)
comment on table public.video_heat_sessions is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: per-session heatmap aggregates (viewport, scroll, per-second counts); pruned with the session at 90 days.';
comment on table public.video_heat_events is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: normalized click coordinates, CTA impressions and scroll milestones (no text, no pointer movement); pruned at 90 days.';
comment on table public.video_watch_seconds is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: aggregated per-second watch counts per video/day/viewport; pruned at 90 days.';
comment on function public._heat_min_cohort() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: the single definition of the minimum cohort (K).';
comment on function public.ingest_video_heat_events(text, text, jsonb) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_clicks(text, date, date, text, text, integer) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_cta_stats(text, date, date, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_scroll(text, date, date, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_engagement(text, date, date, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
