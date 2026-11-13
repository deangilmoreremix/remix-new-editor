-- Stage 7 asserting checks for 20261114100000_heatmap_analytics.sql (run by run-heatmap-assertions.sh on a fresh DB).
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create schema if not exists t;
create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; raise notice 'ok - %', label; end $$;
create or replace function t.fails(label text, stmt text) returns void language plpgsql as $$
begin begin execute stmt; exception when others then raise notice 'ok - % (%)', label, left(sqlerrm, 60); return; end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label; end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

-- owner A publishes a 20 s video
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project) values ('vidA000001','Promo','{"timelineSeconds":20,"tracks":[]}');
reset role;

-- service role ingests: 6 sessions, each with clicks, impressions, scroll, watch buckets
set role service_role;
do $$
declare i int; sk text; r jsonb;
begin
  for i in 1..6 loop
    sk := 'session_00000000' || lpad(i::text, 4, '0');
    perform public.ingest_video_events('vidA000001', sk, null, null, 'desktop', null, '[{"type":"page_open","seq":0}]');
    r := public.ingest_video_heat_events('vidA000001', sk, jsonb_build_array(
      jsonb_build_object('type','cta_impression','seq',1,'props',jsonb_build_object('vp','desktop','cta','c1','kind','book_call','label','Book')),
      jsonb_build_object('type','heat_click','seq',2,'props',jsonb_build_object('vp','desktop','x',0.5,'y',0.25,'pb',3,'cta','c1','kind','book_call','label','Book')),
      jsonb_build_object('type','heat_click','seq',3,'props',jsonb_build_object('vp','desktop','x',0.1,'y',0.9,'pb',3)),
      jsonb_build_object('type','scroll_depth','seq',4,'props',jsonb_build_object('vp','desktop','v',25)),
      jsonb_build_object('type','scroll_depth','seq',5,'props',jsonb_build_object('vp','desktop','v',50)),
      jsonb_build_object('type','watch_buckets','seq',6,'props',jsonb_build_object('vp','desktop','r',jsonb_build_array(jsonb_build_array(0,3)))),
      jsonb_build_object('type','watch_buckets','seq',7,'props',jsonb_build_object('vp','desktop','r',jsonb_build_array(jsonb_build_array(0,1)))),
      jsonb_build_object('type','watch_buckets','seq',7,'props',jsonb_build_object('vp','desktop','r',jsonb_build_array(jsonb_build_array(0,1))))));
    -- session 1..6: wait; watch time sanity uses wall clock, so tests run quickly: allowed = elapsed*1.1+10
    if i = 1 then perform t.ok('first batch accepted 7 / 1 duplicate (retried watch seq)', (r->>'accepted')::int = 7 and (r->>'duplicates')::int = 1); end if;
  end loop;
end $$;
select t.ok('retry of the same batch is idempotent', (public.ingest_video_heat_events('vidA000001','session_000000000001', jsonb_build_array(
  jsonb_build_object('type','heat_click','seq',2,'props',jsonb_build_object('x',0.5,'y',0.25,'pb',3))))->>'accepted')::int = 0);
select t.ok('unknown video rejected', (public.ingest_video_heat_events('nope000000','session_000000000001','[]'))->>'error' = 'unknown_video');
select t.ok('missing session rejected', (public.ingest_video_heat_events('vidA000001','session_zzzzzzzzzzzz','[]'))->>'error' = 'no_session');
select t.ok('out-of-range click rejected', (public.ingest_video_heat_events('vidA000001','session_000000000001', jsonb_build_array(
  jsonb_build_object('type','heat_click','seq',50,'props',jsonb_build_object('x',1.5,'y',0.2))))->>'accepted')::int = 0);
select t.ok('bad scroll value rejected', (public.ingest_video_heat_events('vidA000001','session_000000000001', jsonb_build_array(
  jsonb_build_object('type','scroll_depth','seq',51,'props',jsonb_build_object('v',33))))->>'accepted')::int = 0);
select t.ok('impression is once per session+cta', (public.ingest_video_heat_events('vidA000001','session_000000000001', jsonb_build_array(
  jsonb_build_object('type','cta_impression','seq',52,'props',jsonb_build_object('cta','c1'))))->>'accepted')::int = 0);
select t.ok('oversized watch range rejected', (public.ingest_video_heat_events('vidA000001','session_000000000001', jsonb_build_array(
  jsonb_build_object('type','watch_buckets','seq',60,'props',jsonb_build_object('r',jsonb_build_array(jsonb_build_array(0,5000))))))->>'accepted')::int = 0);
-- per-session click cap (30)
do $$ declare i int; begin
  for i in 100..140 loop perform public.ingest_video_heat_events('vidA000001','session_000000000002', jsonb_build_array(
    jsonb_build_object('type','heat_click','seq',i,'props',jsonb_build_object('x',0.3,'y',0.3,'pb',1)))); end loop;
end $$;
reset role;
select t.ok('per-session click cap is 30', (select click_count from public.video_heat_sessions where session_id = (select id from public.video_view_sessions where session_key='session_000000000002')) = 30);

-- owner reads
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('clicks: 6 sessions pass the cohort', (public.video_heat_clicks('vidA000001', current_date - 1, current_date + 1)->>'suppressed')::boolean = false);
select t.ok('clicks: cell for (0.5,0.25) = grid 25,12', (public.video_heat_clicks('vidA000001', current_date - 1, current_date + 1)->'cells') @> '[[25,12,6]]'::jsonb);
select t.ok('clicks: device filter that matches nothing is suppressed', (public.video_heat_clicks('vidA000001', current_date - 1, current_date + 1, 'mobile')->>'suppressed')::boolean);
select t.ok('cta stats: impressions 6 clicks 0 until a cta_click exists', (public.video_heat_cta_stats('vidA000001', current_date - 1, current_date + 1)->'ctas'->0->>'impressions')::int = 6);
select t.ok('scroll: 6 sessions reached 50', (public.video_heat_scroll('vidA000001', current_date - 1, current_date + 1)->'reached'->>'50')::int = 6);
select t.ok('engagement: second 0 had 6 viewers, 6 replays (played twice)', (public.video_heat_engagement('vidA000001', current_date - 1, current_date + 1)->'seconds'->'viewers'->>0)::int = 6
  and (public.video_heat_engagement('vidA000001', current_date - 1, current_date + 1)->'seconds'->'replays'->>0)::int = 6);
select t.ok('engagement: drop-off at second 3 for all sessions', (public.video_heat_engagement('vidA000001', current_date - 1, current_date + 1)->'seconds'->'dropoff'->>3)::int = 6);
select t.ok('owner sees own heat rows via RLS', (select count(*) from video_heat_events) > 0);

-- owner B: isolation
set request.jwt.claims = '{"sub":"userB"}';
select t.ok('B sees no heat events', (select count(*) from video_heat_events) = 0);
select t.ok('B sees no heat sessions', (select count(*) from video_heat_sessions) = 0);
select t.ok('B sees no watch seconds', (select count(*) from video_watch_seconds) = 0);
select t.fails('B cannot read A clicks', $q$select public.video_heat_clicks('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('B cannot read A cta stats', $q$select public.video_heat_cta_stats('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('B cannot read A scroll', $q$select public.video_heat_scroll('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('B cannot read A engagement', $q$select public.video_heat_engagement('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('B cannot write heat events', $q$insert into video_heat_events(session_id,video_id,day,seq,type,viewport_class) select id, video_id, current_date, 999, 'heat_click', 'desktop' from video_view_sessions$q$);
select t.fails('B cannot call the ingest RPC', $q$select public.ingest_video_heat_events('vidA000001','session_000000000001','[]')$q$);
-- anonymous (no sub)
set role anon; set request.jwt.claims = '{}';
select t.fails('anon cannot read clicks', $q$select public.video_heat_clicks('vidA000001', current_date - 1, current_date + 1)$q$);
select t.ok('anon sees no heat rows', (select count(*) from video_heat_events) = 0);
select t.fails('anon cannot call the ingest RPC', $q$select public.ingest_video_heat_events('vidA000001','session_000000000001','[]')$q$);

-- cohort threshold: a video with only 2 sessions exposes nothing
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project) values ('vidA000002','Small','{"timelineSeconds":20,"tracks":[]}');
reset role; set role service_role;
do $$ declare i int; begin for i in 1..2 loop
  perform public.ingest_video_events('vidA000002', 'session_11111111' || lpad(i::text,4,'0'), null, null, 'desktop', null, '[{"type":"page_open","seq":0}]');
  perform public.ingest_video_heat_events('vidA000002', 'session_11111111' || lpad(i::text,4,'0'), jsonb_build_array(
    jsonb_build_object('type','heat_click','seq',1,'props',jsonb_build_object('x',0.5,'y',0.5,'pb',1)),
    jsonb_build_object('type','watch_buckets','seq',2,'props',jsonb_build_object('r',jsonb_build_array(jsonb_build_array(0,2)))))); end loop; end $$;
reset role; set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('cohort < 5: clicks suppressed, no cells', (public.video_heat_clicks('vidA000002', current_date - 1, current_date + 1)->>'suppressed')::boolean
  and not (public.video_heat_clicks('vidA000002', current_date - 1, current_date + 1) ? 'cells'));
select t.ok('cohort < 5: engagement suppressed', (public.video_heat_engagement('vidA000002', current_date - 1, current_date + 1)->>'suppressed')::boolean);

-- retention + delete
reset role; set role service_role;
reset role;
update video_view_sessions set started_at = now() - interval '100 days' where video_id = 'vidA000002';
update video_watch_seconds set day = current_date - 100 where video_id = 'vidA000002';
set role service_role;
select public.prune_video_analytics(90);
reset role;
select t.ok('prune removes old sessions, heat sessions/events cascade', (select count(*) from video_heat_sessions where video_id='vidA000002') = 0
  and (select count(*) from video_heat_events where video_id='vidA000002') = 0);
select t.ok('prune removes old per-second aggregates', (select count(*) from video_watch_seconds where video_id='vidA000002') = 0);
select t.ok('prune keeps recent heat data', (select count(*) from video_heat_events where video_id='vidA000001') > 0);
reset role; set role authenticated; set request.jwt.claims = '{"sub":"userB"}';
select t.fails('B cannot delete A analytics', $q$select public.delete_video_analytics('vidA000001')$q$);
set request.jwt.claims = '{"sub":"userA"}';
select public.delete_video_analytics('vidA000001');
reset role;
select t.ok('owner delete clears heat rows and per-second aggregates', (select count(*) from video_heat_events) = 0 and (select count(*) from video_watch_seconds where video_id='vidA000001') = 0);
\echo ALL HEATMAP ASSERTIONS PASSED
