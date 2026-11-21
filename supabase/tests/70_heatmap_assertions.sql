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
select t.ok('engagement: drop-off bin covers seconds 0-3 with all 6 sessions', (public.video_heat_engagement('vidA000001', current_date - 1, current_date + 1)->'seconds'->'dropoff_bins') = '[[0,3,6]]'::jsonb);
-- raw rows are NOT readable by the owner directly (RLS on, no policy, no grant): they would bypass the small-cell rules
select t.fails('owner cannot SELECT raw heat events directly', $q$select count(*) from video_heat_events$q$);
select t.fails('owner cannot SELECT raw heat sessions directly', $q$select count(*) from video_heat_sessions$q$);
select t.fails('owner cannot SELECT raw per-second rows directly', $q$select count(*) from video_watch_seconds$q$);

-- owner B: isolation
set request.jwt.claims = '{"sub":"userB"}';
select t.fails('B cannot SELECT raw heat events', $q$select count(*) from video_heat_events$q$);
select t.fails('B cannot SELECT raw heat sessions', $q$select count(*) from video_heat_sessions$q$);
select t.fails('B cannot SELECT raw per-second rows', $q$select count(*) from video_watch_seconds$q$);
select t.fails('B cannot read A clicks', $q$select public.video_heat_clicks('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('B cannot read A cta stats', $q$select public.video_heat_cta_stats('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('B cannot read A scroll', $q$select public.video_heat_scroll('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('B cannot read A engagement', $q$select public.video_heat_engagement('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('B cannot write heat events', $q$insert into video_heat_events(session_id,video_id,day,seq,type,viewport_class) select id, video_id, current_date, 999, 'heat_click', 'desktop' from video_view_sessions$q$);
select t.fails('B cannot call the ingest RPC', $q$select public.ingest_video_heat_events('vidA000001','session_000000000001','[]')$q$);
-- anonymous (no sub)
set role anon; set request.jwt.claims = '{}';
select t.fails('anon cannot read clicks', $q$select public.video_heat_clicks('vidA000001', current_date - 1, current_date + 1)$q$);
select t.fails('anon cannot SELECT raw heat rows', $q$select count(*) from video_heat_events$q$);
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

-- ===================================================================== small-cell suppression + complementary disclosure
-- vidA000003: 12 sessions. Clicks: 6 sessions in one fine cell P (0.5,0.5); 5 sessions each in a DIFFERENT fine cell of the
-- same 5x5 block (so only the merged block reaches 5 sessions); 1 session alone at (0.9,0.9) on page bucket 2.
-- CTA c1: seen by 12, used by 3 (small cell); c2: seen by 2 (small); c3: seen by 8, used by 6.
-- Scroll: 8 reached 100, 1 reached 75, 2 reached 50, 1 reached 25.
-- Playback: all 12 watch seconds 0-3; 3 watch to 5; ONE session watches to second 9; 6 replay second 0, 2 replay second 1.
reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project) values ('vidA000003','Cells','{"timelineSeconds":20,"tracks":[]}');
reset role; set role service_role;
do $$
declare i int; sk text; evs jsonb; sq int; mx int; v int; ex numeric; ey numeric;
begin
  for i in 1..12 loop
    sk := 'session_3333' || lpad(i::text, 4, '0');
    perform public.ingest_video_events('vidA000003', sk, null, null, 'desktop', null,
      (case when i <= 6 then '[{"type":"page_open","seq":0},{"type":"cta_click","seq":1,"clip":"c3"}' else '[{"type":"page_open","seq":0}' end
       || case when i <= 3 then ',{"type":"cta_click","seq":2,"clip":"c1"}' else '' end || ']')::jsonb);
    sq := 10;
    evs := jsonb_build_array(jsonb_build_object('type','cta_impression','seq',sq,'props',jsonb_build_object('vp','desktop','cta','c1','kind','book_call','label','Book')));
    if i <= 8 then sq := sq + 1; evs := evs || jsonb_build_object('type','cta_impression','seq',sq,'props',jsonb_build_object('cta','c3','kind','call_now','label','Call')); end if;
    if i <= 2 then sq := sq + 1; evs := evs || jsonb_build_object('type','cta_impression','seq',sq,'props',jsonb_build_object('cta','c2','kind','other','label','Other')); end if;
    if i <= 6 then ex := 0.5; ey := 0.5; elsif i <= 11 then ex := 0.10 + 0.02 * (i - 7); ey := 0.10 + 0.02 * (i - 7); else ex := 0.9; ey := 0.9; end if;
    sq := sq + 1; evs := evs || jsonb_build_object('type','heat_click','seq',sq,'props',jsonb_build_object('x',ex,'y',ey,'pb',case when i = 12 then 2 else 1 end));
    mx := case when i <= 8 then 100 when i = 9 then 75 when i <= 11 then 50 else 25 end;
    foreach v in array array[25,50,75,100] loop
      if v <= mx then sq := sq + 1; evs := evs || jsonb_build_object('type','scroll_depth','seq',sq,'props',jsonb_build_object('v',v)); end if;
    end loop;
    sq := sq + 1; evs := evs || jsonb_build_object('type','watch_buckets','seq',sq,'props',jsonb_build_object('r',
      jsonb_build_array(jsonb_build_array(0, case when i = 12 then 9 when i <= 3 then 5 else 3 end))));
    if i <= 6 then sq := sq + 1; evs := evs || jsonb_build_object('type','watch_buckets','seq',sq,'props',jsonb_build_object('r', jsonb_build_array(jsonb_build_array(0,0)))); end if;
    if i <= 2 then sq := sq + 1; evs := evs || jsonb_build_object('type','watch_buckets','seq',sq,'props',jsonb_build_object('r', jsonb_build_array(jsonb_build_array(1,1)))); end if;
    perform public.ingest_video_heat_events('vidA000003', sk, evs);
  end loop;
end $$;
reset role; set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
create temp table cl as select public.video_heat_clicks('vidA000003', current_date - 1, current_date + 1) as r;
grant select on cl to authenticated;
select t.ok('threshold is defined once: min_cohort comes from _heat_min_cohort() (5)', (select (r->>'min_cohort')::int from cl) = 5);
select t.ok('click cell with 6 sessions is shown exactly', (select r->'cells' from cl) = '[[25,25,6]]'::jsonb);
select t.ok('5 single-session fine cells are merged into ONE coarse block of 5 sessions (no fine cell is exposed)', (select r->'coarse' from cl) = '[[1,1,5]]'::jsonb);
select t.ok('the lone click (1 session) is not in cells, coarse or other; only a boolean says something was withheld',
  (select r->'other' from cl) = 'null'::jsonb and (select (r->>'withheld')::boolean from cl) and not (select r::text like '%[45,45%' or r::text like '%[9,9%' from cl));
select t.ok('complementary disclosure: clicks total counts only displayed cells (11 of 12 clicks), so 12 - 11 is not available',
  (select (r->>'clicks')::int from cl) = 11 and (select (r->>'sessions')::int from cl) = 12);
select t.ok('page buckets: bucket 2 (1 session) is not listed, no other pool either',
  (select r->'page_buckets' from cl) = '[{"page_bucket": 1, "clicks": 11}]'::jsonb and (select r->'page_buckets_other' from cl) = 'null'::jsonb);
select t.ok('CTA filter that leaves 1 session is suppressed at view level', (public.video_heat_clicks('vidA000003', current_date - 1, current_date + 1, null, 'nope')->>'suppressed')::boolean);
-- CTA table
create temp table ct as select jsonb_array_elements(public.video_heat_cta_stats('vidA000003', current_date - 1, current_date + 1)->'ctas') as r;
grant select on ct to authenticated;
select t.ok('c1: 12 impressions shown; 3 clicks are a small cell -> clicks and CTR withheld, flagged',
  (select (r->>'impressions')::int = 12 and r->'clicks' = 'null'::jsonb and (r->>'clicks_suppressed')::boolean and r->'ctr' = 'null'::jsonb from ct where r->>'cta_key' = 'c1'));
select t.ok('c2: 2 impressions -> whole row suppressed, no numbers',
  (select (r->>'suppressed')::boolean and r->'impressions' = 'null'::jsonb and r->'clicks' = 'null'::jsonb from ct where r->>'cta_key' = 'c2'));
select t.ok('c3: 8 impressions, 6 clicks, CTR 0.75 shown',
  (select (r->>'impressions')::int = 8 and (r->>'clicks')::int = 6 and (r->>'ctr')::numeric = 0.75 from ct where r->>'cta_key' = 'c3'));
-- scroll: bands 0/1/2/1/8 -> the 4 sessions below the 100 band are < 5, so everything merges: nothing can be subtracted
select t.ok('scroll: small bands merge into their neighbour, no reached value exposes a band < 5',
  (select public.video_heat_scroll('vidA000003', current_date - 1, current_date + 1)->'reached' = '{"25":null,"50":null,"75":null,"100":null}'::jsonb)
  and (select public.video_heat_scroll('vidA000003', current_date - 1, current_date + 1)->'bands' = '[{"from":0,"sessions":12}]'::jsonb));
select t.ok('scroll: CTA exposure shown when both "saw a CTA" (12) and "saw none" (0) are displayable',
  (public.video_heat_scroll('vidA000003', current_date - 1, current_date + 1)->>'cta_exposed_sessions')::int = 12);
-- engagement
create temp table en as select public.video_heat_engagement('vidA000003', current_date - 1, current_date + 1)->'seconds' as r;
grant select on en to authenticated;
select t.ok('engagement: series ends at the last second with >= 5 viewers (a single viewer reaching second 9 is not visible)',
  (select jsonb_array_length(r->'viewers') from en) = 4 and (select r->'viewers' from en) = '[12,12,12,12]'::jsonb);
select t.ok('engagement: replays 6 shown, 2 withheld (null), 0 shown', (select r->'replays' from en) = '[6,null,0,0]'::jsonb);
select t.ok('engagement: drop-off bins are >= 5 sessions each and sum to all sessions (single bin 0-3 = 12)', (select r->'dropoff_bins' from en) = '[[0,3,12]]'::jsonb);
-- scenario B on the same data: scroll bands 0/0/5/2/5 -> groups are all >= 5 or empty
reset role;
update video_heat_sessions set max_scroll = case when session_id in (select id from video_view_sessions where video_id='vidA000003' and session_key in ('session_33330001','session_33330002','session_33330003','session_33330004','session_33330005')) then 100
  when session_id in (select id from video_view_sessions where video_id='vidA000003' and session_key in ('session_33330006','session_33330007')) then 75 else 50 end
  where video_id = 'vidA000003';
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('scroll B: bands 0/0/5/2/5: the 2 sessions at 75 are merged into the 50..99 group (7), so reached 75 is withheld; 12 and 5 are shown',
  (select public.video_heat_scroll('vidA000003', current_date - 1, current_date + 1)->'reached' = '{"25":12,"50":12,"75":null,"100":5}'::jsonb));
-- scenario C: two sessions saw no CTA -> "saw none" (2) is a small cell, so the exposure figure is withheld
reset role;
delete from video_heat_events where video_id='vidA000003' and type='cta_impression' and cta_key='c1'
  and session_id in (select id from video_view_sessions where video_id='vidA000003' and session_key in ('session_33330011','session_33330012'));
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('scroll C: "saw none" = 2 is a small cell -> cta_exposed_sessions withheld (cannot be recovered as total - 10)',
  (public.video_heat_scroll('vidA000003', current_date - 1, current_date + 1)->'cta_exposed_sessions') = 'null'::jsonb);
-- view with few sessions: no leakage through length of series or bins
reset role;

-- ===================================================================== hardening: explicit privileges only
select t.ok('new tables: RLS enabled, no policies, no grants to public/anon/authenticated',
  (select bool_and(c.relrowsecurity) from pg_class c where c.relname in ('video_heat_sessions','video_heat_events','video_watch_seconds') and c.relnamespace = 'public'::regnamespace)
  and not exists (select 1 from pg_policy p join pg_class c on c.oid = p.polrelid where c.relname in ('video_heat_sessions','video_heat_events','video_watch_seconds'))
  and not exists (select 1 from pg_class c, aclexplode(c.relacl) a where c.relname in ('video_heat_sessions','video_heat_events','video_watch_seconds')
                  and a.grantee in (0, 'anon'::regrole, 'authenticated'::regrole)));
select t.ok('every new/redefined function: EXECUTE is not granted to PUBLIC or anon',
  not exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.pronamespace = 'public'::regnamespace
              and p.proname in ('ingest_video_heat_events','video_heat_clicks','video_heat_cta_stats','video_heat_scroll','video_heat_engagement','_heat_min_cohort','_heat_ok','_heat_assert_owner','prune_video_analytics','delete_video_analytics')
              and a.privilege_type = 'EXECUTE' and a.grantee in (0, 'anon'::regrole)));
select t.ok('owner RPCs: EXECUTE for authenticated only; writer: service_role only; helpers: nobody',
  (select bool_and(has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('service_role', p.oid, 'execute'))
     from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('video_heat_clicks','video_heat_cta_stats','video_heat_scroll','video_heat_engagement'))
  and has_function_privilege('service_role', 'public.ingest_video_heat_events(text,text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.ingest_video_heat_events(text,text,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.ingest_video_heat_events(text,text,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public._heat_min_cohort()', 'execute')
  and not has_function_privilege('authenticated', 'public._heat_assert_owner(text)', 'execute'));
select t.ok('every SECURITY DEFINER function of the migration pins search_path',
  not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
              and p.proname in ('ingest_video_heat_events','video_heat_clicks','video_heat_cta_stats','video_heat_scroll','video_heat_engagement','_heat_assert_owner','prune_video_analytics','delete_video_analytics')
              and not coalesce(p.proconfig::text like '%search_path=%', false)));

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
select t.ok('owner delete clears heat rows and per-second aggregates', (select count(*) from video_heat_events where video_id='vidA000001') = 0 and (select count(*) from video_watch_seconds where video_id='vidA000001') = 0);
\echo ALL HEATMAP ASSERTIONS PASSED
