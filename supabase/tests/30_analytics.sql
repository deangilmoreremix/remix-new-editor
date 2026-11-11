\pset format unaligned
\pset tuples_only on
\set ON_ERROR_STOP off
-- setup as owner A
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project) values ('vidAn00001','One','{"timelineSeconds":20,"tracks":[]}'),('vidAn00002','Two','{"timelineSeconds":10,"tracks":[]}');
set request.jwt.claims = '{"sub":"userB"}';
insert into published_videos(id,title,project) values ('vidBn00001','B video','{"timelineSeconds":10,"tracks":[]}');
reset role;
set role service_role;
\echo '--- ingest batch 1'
select ingest_video_events('vidAn00001','sess-aaaaaaaaaaaaaaaa','abcdef0123456789abcdef0123456789',null,'desktop','example.com',
 '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0},{"type":"watch","seq":2,"t0":0,"t1":5},{"type":"progress_25","seq":3,"t":5.1},{"type":"cta_click","seq":4,"clip":"cta1","props":{"label":"Get quote","pricing":true}},{"type":"cta_click","seq":5,"clip":"cta1"},{"type":"cta_click","seq":6,"clip":"cta2"},{"type":"call_click","seq":7,"clip":"tel1"},{"type":"lead_submit","seq":8,"clip":"form1"},{"type":"bogus","seq":9},{"type":"pause","seq":10,"t":5.2}]');
\echo '--- retried identical batch (idempotent)'
select ingest_video_events('vidAn00001','sess-aaaaaaaaaaaaaaaa','abcdef0123456789abcdef0123456789',null,'desktop','example.com',
 '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0},{"type":"watch","seq":2,"t0":0,"t1":5},{"type":"cta_click","seq":4,"clip":"cta1"}]');
\echo '--- inflated watch time (110s claimed in a brand-new session) is clamped'
select ingest_video_events('vidAn00001','sess-aaaaaaaaaaaaaaaa','abcdef0123456789abcdef0123456789',null,'desktop','example.com',
 '[{"type":"watch","seq":11,"t0":5,"t1":115},{"type":"watch","seq":12,"t0":0,"t1":200}]');
reset role;
select 'session watch_seconds=' || round(watch_seconds,1) || ' (must be <= ~10.5), played=' || played || ' events=' || event_count from video_view_sessions where session_key='sess-aaaaaaaaaaaaaaaa';
select 'daily: visits=' || page_visits || ' plays=' || plays || ' sessions=' || sessions || ' cta=' || cta_clicks || ' calls=' || call_clicks || ' leads=' || leads || ' p25=' || progress_25 from video_analytics_daily where video_id='vidAn00001';
select 'distinct cta events: ' || count(*) from video_events where type='cta_click';
select 'bogus stored: ' || count(*) from video_events where type='bogus';
select 'view_count: ' || view_count from published_videos where id='vidAn00001';
select 'retention buckets covered: ' || count(*) || ' max viewers=' || max(viewers) from video_retention_buckets where video_id='vidAn00001';
\echo '--- rejects'
set role service_role;
select 'unknown video: ' || (ingest_video_events('nopenope12','sess-aaaaaaaaaaaaaaaa',null,null,null,null,'[]'))::text;
select 'bad session: ' || (ingest_video_events('vidAn00001','x',null,null,null,null,'[]'))::text;
select 'too many events: ' || (ingest_video_events('vidAn00001','sess-bbbbbbbbbbbbbbbb',null,null,null,null,(select jsonb_agg(jsonb_build_object('type','pause','seq',g)) from generate_series(1,26) g)))::text;
reset role;
update published_videos set published=false where id='vidAn00002';
set role service_role;
select 'unpublished: ' || (ingest_video_events('vidAn00002','sess-cccccccccccccccc',null,null,null,null,'[]'))::text;
reset role;
update published_videos set published=true where id='vidAn00002';
\echo '--- returning viewer on second session, same viewer on another video'
set role service_role;
select ingest_video_events('vidAn00001','sess-dddddddddddddddd','abcdef0123456789abcdef0123456789',null,'mobile',null,'[{"type":"page_open","seq":0},{"type":"play","seq":1},{"type":"watch","seq":2,"t0":0,"t1":2},{"type":"complete","seq":3}]');
select ingest_video_events('vidAn00002','sess-eeeeeeeeeeeeeeee','abcdef0123456789abcdef0123456789',null,'desktop',null,'[{"type":"page_open","seq":0},{"type":"play","seq":1}]');
select ingest_video_events('vidAn00001','sess-ffffffffffffffff',null,'c-77','desktop',null,'[{"type":"page_open","seq":0},{"type":"play","seq":1}]');
reset role;
select 'returning sessions: ' || count(*) from video_view_sessions where is_return;
select 'return events: ' || count(*) from video_events where type='return';
-- owner reads
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select 'A summary: ' || (video_analytics_summary('vidAn00001', current_date - 1, current_date + 1))::text;
select 'A portfolio: ' || (owner_portfolio_summary(current_date - 1, current_date + 1))::text;
select 'A stats rows: ' || count(*) from owner_video_stats(current_date - 1, current_date + 1);
select 'A retention b0/b25/b26: ' || (select string_agg(viewers::text, '/' order by bucket) from video_retention_curve('vidAn00001') where bucket in (0,25,26));
select 'A ctas: ' || count(*) from video_cta_performance('vidAn00001', current_date - 1, current_date + 1);
select 'A timeseries rows: ' || count(*) from video_analytics_timeseries('vidAn00001', current_date - 2, current_date);
select 'A by contact: ' || count(*) from video_events_by_contact('vidAn00001');
-- tenant isolation
set request.jwt.claims = '{"sub":"userB"}';
select 'B summary of A video plays: ' || (video_analytics_summary('vidAn00001', current_date - 1, current_date + 1)->>'plays');
select 'B sessions visible: ' || count(*) from video_view_sessions;
select 'B events visible: ' || count(*) from video_events;
select 'B portfolio plays: ' || (owner_portfolio_summary(current_date - 1, current_date + 1)->>'plays');
select 'B delete A analytics:'; select delete_video_analytics('vidAn00001');
-- public / privileged
set role anon; set request.jwt.claims = '{}';
select 'anon sessions: ' || count(*) from video_view_sessions;
select 'anon ingest:'; select ingest_video_events('vidAn00001','sess-zzzzzzzzzzzzzzzz',null,null,null,null,'[]');
select 'anon record_video_event:'; select record_video_event('vidAn00001','view');
select 'anon increment_video_view:'; select increment_video_view('vidAn00001');
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select 'auth ingest:'; select ingest_video_events('vidAn00001','sess-zzzzzzzzzzzzzzzz',null,null,null,null,'[]');
select 'auth direct insert:'; insert into video_events(session_id,video_id,seq,type) select id,video_id,999,'play' from video_view_sessions limit 1;
\echo '--- event cap per session'
reset role; set role service_role;
do $$ declare i int; begin for i in 0..9 loop perform ingest_video_events('vidAn00002','sess-capcapcapcapcap1',null,null,null,null,(select jsonb_agg(jsonb_build_object('type','pause','seq',i*25+g)) from generate_series(1,25) g)); end loop; end $$;
reset role;
select 'event_count capped: ' || event_count || ', rows=' || (select count(*) from video_events e where e.session_id = s.id) from video_view_sessions s where session_key='sess-capcapcapcapcap1';
\echo '--- delete + prune'
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select 'A delete: ' || (delete_video_analytics('vidAn00001'))::text;
reset role;
select 'after delete sessions for video1: ' || count(*) from video_view_sessions where video_id='vidAn00001';
update video_view_sessions set started_at = now() - interval '120 days';
set role service_role;
select 'prune: ' || (prune_video_analytics(90))::text;
reset role;
select 'sessions after prune: ' || count(*) from video_view_sessions;
select 'daily kept after prune: ' || count(*) from video_analytics_daily;
