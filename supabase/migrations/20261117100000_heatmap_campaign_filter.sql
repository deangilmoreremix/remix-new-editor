-- ===========================================================================
-- heatmap_campaign_filter.sql — Stage 11 (Fix O): optional campaign filter for the Stage 7 heatmap RPCs
--
-- ADDITIVE and DEGRADES GRACEFULLY. Nothing in 20261114100000_heatmap_analytics.sql is edited. This migration works
-- whether or not a campaign linkage exists in the database:
--
--   Linkage contract (see docs/stage-11/FIX_O_REPORT.md for the evidence): a nullable column
--       public.video_view_sessions.campaign_id   (uuid; text also works, it is compared as text)
--   that whatever records a view (a future ingest change driven by the recipient token / utm_campaign) fills in.
--   The unmerged campaigns branch (origin/claude/modest-tesla-yhjel6, 20261113000000_video_campaigns.sql) defines
--   video_campaigns / campaign_recipients but NO column joining a view session to a campaign, so this migration does
--   NOT add that column: nothing would write it, and an always-empty column would show a filter that filters nothing.
--   The linkage is detected AT CALL TIME through information_schema (_heat_campaign_linked()).
--
--   * No linkage column: video_heat_campaign_options() says {available:false}; the UI hides the control; the four
--     RPCs behave exactly as before when p_campaign is null (the only value existing callers send). A non-null
--     p_campaign without linkage raises 0A000 'campaign_filter_unavailable' (never silently returns unfiltered data).
--   * Linkage present: p_campaign restricts sessions / events / bins to that campaign's sessions.
--
-- Small-cohort protection (differencing): a campaign view is only released when
--     (a) the campaign has >= K sessions in the video/date/device scope (existing per-view rules then apply inside it), AND
--     (b) the sessions OUTSIDE that campaign, with every group of fewer than K sessions (including "no campaign") pooled,
--         number 0 or >= K.
--   Otherwise the scope is empty and the RPC returns its normal "suppressed" answer. Consequence: the unfiltered view minus
--   any campaign view is a sum of groups that each hold 0 or >= K sessions, so a small campaign (or the unattributed
--   remainder) cannot be recovered by subtraction. Residual risk as for the other filters: overlapping date ranges/devices.
--
-- Signatures: a defaulted trailing parameter creates a new OVERLOAD, and PostgREST cannot choose between two overloads
-- when a call omits the defaulted argument ("could not choose the best candidate function"). The four old signatures are
-- therefore DROPPED and replaced; calls that omit p_campaign (positional or named) keep working against the new ones.
-- Grants stay as in Stage 7: authenticated only; helpers are not callable by any API role.
-- Idempotent: safe to run twice.
-- ===========================================================================

drop function if exists public.video_heat_clicks(text, date, date, text, text, integer);
drop function if exists public.video_heat_cta_stats(text, date, date, text);
drop function if exists public.video_heat_scroll(text, date, date, text);
drop function if exists public.video_heat_engagement(text, date, date, text);

create or replace function public._heat_campaign_linked()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'video_view_sessions' and column_name = 'campaign_id');
$$;

-- Session ids of ONE campaign for a video, or none when the cohort rules (header) are not met. Owner is asserted by the
-- callers (the RPCs call _heat_assert_owner first); this helper is not granted to any API role.
create or replace function public._heat_campaign_scope(p_video_id text, p_from date, p_to date, p_viewport text, p_campaign uuid)
returns setof uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k integer := public._heat_min_cohort();
  mine integer; small_pool integer;
begin
  if p_campaign is null then return; end if;
  if not public._heat_campaign_linked() then
    raise exception 'campaign_filter_unavailable' using errcode = '0A000';
  end if;
  execute $q$
    with g as (
      select vs.campaign_id::text as cid, count(*) as n
        from public.video_heat_sessions hs
        join public.video_view_sessions vs on vs.id = hs.session_id
       where hs.video_id = $1 and hs.day between $2 and $3 and ($4 is null or hs.viewport_class = $4)
       group by vs.campaign_id::text)
    select coalesce((select n from g where cid = $5::text), 0),
           coalesce((select sum(n) from g where n < $6 and cid is distinct from $5::text), 0)
  $q$ into mine, small_pool using p_video_id, p_from, p_to, p_viewport, p_campaign, k;
  if mine < k or (small_pool > 0 and small_pool < k) then return; end if;
  return query execute $q$
    select hs.session_id
      from public.video_heat_sessions hs
      join public.video_view_sessions vs on vs.id = hs.session_id
     where hs.video_id = $1 and hs.day between $2 and $3 and ($4 is null or hs.viewport_class = $4)
       and vs.campaign_id::text = $5::text
  $q$ using p_video_id, p_from, p_to, p_viewport, p_campaign;
end;
$$;
revoke all on function public._heat_campaign_linked() from public, anon, authenticated, service_role;
revoke all on function public._heat_campaign_scope(text, date, date, text, uuid) from public, anon, authenticated, service_role;

-- ---- the four owner RPCs, re-created with a trailing optional p_campaign (bodies identical to 20261114100000 apart from the marked filter lines)
create or replace function public.video_heat_clicks(
  p_video_id text, p_from date, p_to date,
  p_viewport text default null, p_cta text default null, p_page_bucket integer default null,
  p_campaign uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k integer := public._heat_min_cohort();
  sess integer; res jsonb; scope uuid[];
begin
  perform public._heat_assert_owner(p_video_id);
  if p_campaign is not null then
    scope := array(select public._heat_campaign_scope(p_video_id, p_from, p_to, p_viewport, p_campaign));
  end if;
  select count(distinct e.session_id) into sess
    from public.video_heat_events e
   where e.video_id = p_video_id and e.type = 'heat_click' and e.day between p_from and p_to
     and (p_viewport is null or e.viewport_class = p_viewport)
     and (p_cta is null or e.cta_key = p_cta)
     and (p_page_bucket is null or e.page_bucket = p_page_bucket)
     and (p_campaign is null or e.session_id = any(scope));
  if sess < k then
    return jsonb_build_object('suppressed', true, 'min_cohort', k, 'sessions', sess);
  end if;
  with evp as (
    select e.session_id as sid, least(49, e.x / 20) as cx, least(49, e.y / 20) as cy, e.page_bucket as pb, e.cta_key
      from public.video_heat_events e
     where e.video_id = p_video_id and e.type = 'heat_click' and e.day between p_from and p_to
       and (p_viewport is null or e.viewport_class = p_viewport)
       and (p_campaign is null or e.session_id = any(scope))),
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

create or replace function public.video_heat_cta_stats(p_video_id text, p_from date, p_to date, p_viewport text default null, p_campaign uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare out jsonb; sess integer; k integer := public._heat_min_cohort(); scope uuid[];
begin
  perform public._heat_assert_owner(p_video_id);
  if p_campaign is not null then
    scope := array(select public._heat_campaign_scope(p_video_id, p_from, p_to, p_viewport, p_campaign));
  end if;
  select count(*) into sess from public.video_heat_sessions hs
   where hs.video_id = p_video_id and hs.day between p_from and p_to and (p_viewport is null or hs.viewport_class = p_viewport)
     and (p_campaign is null or hs.session_id = any(scope));
  with imp as (
    select e.cta_key, max(e.cta_kind) as kind, max(e.cta_label) as label, count(distinct e.session_id) as impressions
      from public.video_heat_events e
     where e.video_id = p_video_id and e.type = 'cta_impression' and e.day between p_from and p_to
       and (p_viewport is null or e.viewport_class = p_viewport)
       and (p_campaign is null or e.session_id = any(scope))
     group by e.cta_key),
  clk as (
    select ve.clip_id as cta_key, max(ve.props ->> 'label') as label, count(distinct ve.session_id) as clicks
      from public.video_events ve
      join public.video_view_sessions vs on vs.id = ve.session_id
      left join public.video_heat_sessions hs on hs.session_id = ve.session_id
     where ve.video_id = p_video_id and ve.type in ('cta_click', 'call_click', 'lead_submit') and ve.clip_id is not null
       and (vs.started_at at time zone 'utc')::date between p_from and p_to
       and (p_viewport is null or hs.viewport_class = p_viewport)
       and (p_campaign is null or ve.session_id = any(scope))
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

create or replace function public.video_heat_scroll(p_video_id text, p_from date, p_to date, p_viewport text default null, p_campaign uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k integer := public._heat_min_cohort();
  sess integer; r25 integer; r50 integer; r75 integer; r100 integer; cta_seen integer;
  scope uuid[]; b integer[]; starts boolean[] := array[false, false, false, false, false];
  acc integer := 0; lowest_real integer := 6; i integer; j integer; nxt integer; tot integer;
  reached jsonb := '{}'::jsonb; bands jsonb := '[]'::jsonb;
begin
  perform public._heat_assert_owner(p_video_id);
  if p_campaign is not null then
    scope := array(select public._heat_campaign_scope(p_video_id, p_from, p_to, p_viewport, p_campaign));
  end if;
  select count(*), count(*) filter (where max_scroll >= 25), count(*) filter (where max_scroll >= 50),
         count(*) filter (where max_scroll >= 75), count(*) filter (where max_scroll >= 100)
    into sess, r25, r50, r75, r100
    from public.video_heat_sessions
   where video_id = p_video_id and day between p_from and p_to and (p_viewport is null or viewport_class = p_viewport)
     and (p_campaign is null or session_id = any(scope));
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
     and (p_viewport is null or e.viewport_class = p_viewport)
     and (p_campaign is null or e.session_id = any(scope));
  return jsonb_build_object('suppressed', false, 'min_cohort', k, 'sessions', sess,
    'reached', reached, 'bands', bands,
    -- both "saw a CTA" and "saw none" are cells of the same partition: shown only if each is zero or >= K
    'cta_exposed_sessions', case when public._heat_ok(cta_seen) and public._heat_ok(sess - cta_seen) then to_jsonb(cta_seen) end);
end;
$$;

create or replace function public.video_heat_engagement(p_video_id text, p_from date, p_to date, p_viewport text default null, p_campaign uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k integer := public._heat_min_cohort();
  scope uuid[]; sess integer; dur numeric; cut integer; out jsonb; dv integer[];
  acc integer := 0; st integer := 0; i integer;
  bfrom integer[] := '{}'; bto integer[] := '{}'; bn integer[] := '{}'; bins jsonb := '[]'::jsonb;
begin
  perform public._heat_assert_owner(p_video_id);
  if p_campaign is not null then
    scope := array(select public._heat_campaign_scope(p_video_id, p_from, p_to, p_viewport, p_campaign));
  end if;
  select (project ->> 'timelineSeconds')::numeric into dur from public.published_videos where id = p_video_id;
  select count(*) into sess
    from public.video_heat_sessions
   where video_id = p_video_id and day between p_from and p_to and max_sec >= 0
     and (p_viewport is null or viewport_class = p_viewport)
     and (p_campaign is null or session_id = any(scope));
  if sess < k then
    return jsonb_build_object('suppressed', true, 'min_cohort', k, 'sessions', sess, 'duration_s', dur);
  end if;
  select coalesce(max(sec), -1) into cut from (
    select sec from (select sec, viewers, replays from public.video_watch_seconds
         where video_id = p_video_id and day between p_from and p_to and (p_viewport is null or viewport_class = p_viewport)
           and p_campaign is null
        union all
        select (u.i - 1)::integer, (u.c >= 1)::integer, (u.c >= 2)::integer
          from public.video_heat_sessions hs cross join lateral unnest(hs.sec_counts) with ordinality as u(c, i)
         where p_campaign is not null and hs.session_id = any(scope)
           and hs.video_id = p_video_id and hs.day between p_from and p_to and (p_viewport is null or hs.viewport_class = p_viewport)) src
     group by sec having sum(viewers) >= k) q;
  if cut < 0 then
    return jsonb_build_object('suppressed', false, 'min_cohort', k, 'sessions', sess, 'duration_s', dur,
      'seconds', jsonb_build_object('viewers', '[]'::jsonb, 'replays', '[]'::jsonb, 'skips', '[]'::jsonb, 'dropoff_bins', '[]'::jsonb));
  end if;
  with ends as (
    select least(max_sec, cut) as sec, count(*) as d from public.video_heat_sessions
     where video_id = p_video_id and day between p_from and p_to and max_sec >= 0
       and (p_viewport is null or viewport_class = p_viewport)
       and (p_campaign is null or session_id = any(scope))
     group by 1),
  agg as (
    select sec, sum(viewers) as viewers, sum(replays) as replays from (select sec, viewers, replays from public.video_watch_seconds
         where video_id = p_video_id and day between p_from and p_to and (p_viewport is null or viewport_class = p_viewport)
           and p_campaign is null
        union all
        select (u.i - 1)::integer, (u.c >= 1)::integer, (u.c >= 2)::integer
          from public.video_heat_sessions hs cross join lateral unnest(hs.sec_counts) with ordinality as u(c, i)
         where p_campaign is not null and hs.session_id = any(scope)
           and hs.video_id = p_video_id and hs.day between p_from and p_to and (p_viewport is null or hs.viewport_class = p_viewport)) src
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

revoke all on function public.video_heat_clicks(text, date, date, text, text, integer, uuid) from public, anon, authenticated, service_role;
revoke all on function public.video_heat_cta_stats(text, date, date, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.video_heat_scroll(text, date, date, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.video_heat_engagement(text, date, date, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.video_heat_clicks(text, date, date, text, text, integer, uuid) to authenticated;
grant execute on function public.video_heat_cta_stats(text, date, date, text, uuid) to authenticated;
grant execute on function public.video_heat_scroll(text, date, date, text, uuid) to authenticated;
grant execute on function public.video_heat_engagement(text, date, date, text, uuid) to authenticated;

-- Owner RPC feeding the UI selector. {available:false} when there is no linkage column: the UI then hides the control.
-- Lists only campaign ids that have view sessions of THIS owner's video (no counts: nothing to difference). A name is added
-- from video_campaigns when that table has (id, name, clerk_user_id) and the campaign belongs to the caller.
create or replace function public.video_heat_campaign_options(p_video_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me text := auth.jwt() ->> 'sub';
  named boolean; res jsonb;
begin
  perform public._heat_assert_owner(p_video_id);
  if not public._heat_campaign_linked() then
    return jsonb_build_object('available', false, 'campaigns', '[]'::jsonb);
  end if;
  select count(*) = 3 into named from information_schema.columns
   where table_schema = 'public' and table_name = 'video_campaigns' and column_name in ('id', 'name', 'clerk_user_id');
  if named then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('id', d.cid, 'name', c.name) order by c.name nulls last, d.cid), '[]'::jsonb)
        from (select distinct vs.campaign_id::text as cid from public.video_view_sessions vs
               where vs.video_id = $1 and vs.campaign_id is not null limit 50) d
        left join public.video_campaigns c on c.id::text = d.cid and c.clerk_user_id = $2
    $q$ into res using p_video_id, me;
  else
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('id', d.cid, 'name', null) order by d.cid), '[]'::jsonb)
        from (select distinct vs.campaign_id::text as cid from public.video_view_sessions vs
               where vs.video_id = $1 and vs.campaign_id is not null limit 50) d
    $q$ into res using p_video_id;
  end if;
  return jsonb_build_object('available', true, 'campaigns', res);
end;
$$;
revoke all on function public.video_heat_campaign_options(text) from public, anon, authenticated, service_role;
grant execute on function public.video_heat_campaign_options(text) to authenticated;

comment on function public._heat_campaign_linked() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: call-time check for video_view_sessions.campaign_id.';
comment on function public._heat_campaign_scope(text, date, date, text, uuid) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: campaign session scope with small-cohort / differencing gate.';
comment on function public.video_heat_campaign_options(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_clicks(text, date, date, text, text, integer, uuid) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_cta_stats(text, date, date, text, uuid) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_scroll(text, date, date, text, uuid) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.video_heat_engagement(text, date, date, text, uuid) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
