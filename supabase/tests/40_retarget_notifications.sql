\pset format unaligned
\pset tuples_only on
\set ON_ERROR_STOP off
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into published_videos(id,title,project) values ('vidRt00001','Roofing promo',
 '{"timelineSeconds":100,"tracks":[{"type":"text","items":[{"id":"cta_roof","type":"click-to-call","buttonText":"Book roof inspection"},{"id":"cta_price","type":"click-to-call","buttonText":"Get a quote"},{"id":"form1","type":"lead-form","heading":"Request estimate"}]}],
   "interestMap":[{"id":"roof","title":"Roof repair","start":0,"end":40,"interest":{"type":"service","label":"Roof repair"},"clipIds":["cta_roof","form1"]},
                  {"id":"kitchen","title":"Kitchen","start":40,"end":100,"interest":{"type":"product","label":"Kitchen remodel"}}]}');
set request.jwt.claims = '{"sub":"userB"}';
insert into published_videos(id,title,project) values ('vidRt00002','Other','{"timelineSeconds":10,"tracks":[]}');
reset role;
set role service_role;
select ingest_video_events('vidRt00001','sess-rt1rt1rt1rt1rt1r','aaaa1111bbbb2222cccc3333dddd4444',null,'desktop',null,'[{"type":"page_open","seq":0},{"type":"play","seq":1}]')::text;
reset role;
update video_view_sessions set started_at = now() - interval '10 minutes';
set role service_role;
\echo '--- watch roof section fully (0-40) + 5s of kitchen'
select ingest_video_events('vidRt00001','sess-rt1rt1rt1rt1rt1r',null,null,null,null,'[{"type":"watch","seq":2,"t0":0,"t1":40},{"type":"watch","seq":3,"t0":40,"t1":45}]')::text;
reset role;
select 'interests after watch: ' || coalesce(string_agg(interest_key || '=' || score, ', ' order by interest_key), 'none') from viewer_interests;
set role service_role;
\echo '--- click linked CTA 5 times (must count once), pricing CTA, lead'
select ingest_video_events('vidRt00001','sess-rt1rt1rt1rt1rt1r',null,null,null,null,'[{"type":"cta_click","seq":4,"clip":"cta_roof"},{"type":"cta_click","seq":5,"clip":"cta_roof"},{"type":"cta_click","seq":6,"clip":"cta_roof"},{"type":"cta_click","seq":7,"clip":"cta_roof"},{"type":"cta_click","seq":8,"clip":"cta_roof"},{"type":"cta_click","seq":9,"clip":"cta_price"}]')::text;
reset role;
select 'interests after clicks: ' || string_agg(interest_key || '=' || score, ', ' order by interest_key) from viewer_interests;
select 'notifications after clicks: ' || string_agg(type || '(' || coalesce(metrics->>'count','-') || ')', ', ' order by type) from owner_notifications;
set role service_role;
select ingest_video_events('vidRt00001','sess-rt1rt1rt1rt1rt1r',null,null,null,null,'[{"type":"section_rewatch","seq":10,"section":"roof"},{"type":"lead_submit","seq":11,"clip":"form1"},{"type":"lead_submit","seq":12,"clip":"form1"}]')::text;
reset role;
select 'interests after rewatch+lead: ' || string_agg(interest_key || '=' || score, ', ' order by interest_key) from viewer_interests;
select 'max score capped at 100: ' || (max(score) <= 100) from viewer_interests;
select 'notifications: ' || string_agg(type || '(' || coalesce(metrics->>'count','-') || ')', ', ' order by type) from owner_notifications;
select 'new_lead count (dedupe): ' || count(*) from owner_notifications where type='new_lead';
\echo '--- replay same batch: nothing duplicates, scores stable'
set role service_role;
select ingest_video_events('vidRt00001','sess-rt1rt1rt1rt1rt1r',null,null,null,null,'[{"type":"cta_click","seq":4,"clip":"cta_roof"},{"type":"lead_submit","seq":11,"clip":"form1"}]')::text;
reset role;
select 'notifications total: ' || count(*) from owner_notifications;
select 'scores unchanged: ' || string_agg(interest_key || '=' || score, ', ' order by interest_key) from viewer_interests;
\echo '--- returning viewer, second session on kitchen 40-100 at >=50%'
update video_view_sessions set started_at = now() - interval '9 minutes' where session_key = 'sess-rt1rt1rt1rt1rt1r';
set role service_role;
select ingest_video_events('vidRt00001','sess-rt2rt2rt2rt2rt2r','aaaa1111bbbb2222cccc3333dddd4444',null,'mobile',null,'[{"type":"page_open","seq":0},{"type":"play","seq":1}]')::text;
reset role;
update video_view_sessions set started_at = now() - interval '5 minutes' where session_key = 'sess-rt2rt2rt2rt2rt2r';
set role service_role;
select ingest_video_events('vidRt00001','sess-rt2rt2rt2rt2rt2r',null,null,null,null,'[{"type":"watch","seq":2,"t0":40,"t1":100}]')::text;
reset role;
select 'session2 interests: ' || coalesce(string_agg(i.interest_key || '=' || i.score, ', '), 'none') from viewer_interests i join video_view_sessions s on s.id=i.session_id where s.session_key='sess-rt2rt2rt2rt2rt2r';
-- owner views
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select 'summary: ' || string_agg(interest || '/' || interest_type || ' sessions=' || sessions || ' score=' || decayed_score || ' high=' || high_interest_sessions, '; ') from video_interest_summary('vidRt00001', current_date-1, current_date+1);
select 'segments: ' || string_agg(segment || '=' || sessions, ', ') from video_audience_segments('vidRt00001', current_date-1, current_date+1);
select 'section engagement: ' || string_agg(section_id || '=' || coalesce(engagement_percent::text,'null'), ', ') from video_section_engagement('vidRt00001', '[{"id":"roof","start":0,"end":40},{"id":"kitchen","start":40,"end":100}]'::jsonb, current_date-1, current_date+1);
select 'unread: ' || owner_unread_notifications();
select 'mark one read: ' || mark_notifications_read(array[(select id from owner_notifications order by created_at limit 1)]);
select 'unread now: ' || owner_unread_notifications();
select 'mark all read: ' || mark_notifications_read();
select 'edit title (must fail):'; update owner_notifications set title='hacked';
select 'insert (must fail):'; insert into owner_notifications(clerk_user_id,type,title,summary,dedupe_key) values ('userA','new_lead','x','y','z');
-- isolation
set request.jwt.claims = '{"sub":"userB"}';
select 'B notifications: ' || count(*) from owner_notifications;
select 'B interests: ' || count(*) from viewer_interests;
select 'B summary rows of A video: ' || count(*) from video_interest_summary('vidRt00001', current_date-1, current_date+1);
select 'B segments of A video: ' || coalesce(sum(sessions),0) from video_audience_segments('vidRt00001', current_date-1, current_date+1);
select 'B mark read affects: ' || mark_notifications_read();
set role anon; set request.jwt.claims = '{}';
select 'anon notifications:'; select count(*) from owner_notifications;
select 'anon recompute:'; select recompute_session_interests(gen_random_uuid());
-- preferences
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into retarget_preferences(enabled_types, interest_threshold) values (array['new_lead'], 200);
reset role;
delete from owner_notifications; delete from viewer_interests;
set role service_role;
select ingest_video_events('vidRt00001','sess-rt3rt3rt3rt3rt3r',null,null,null,null,'[{"type":"play","seq":1},{"type":"cta_click","seq":2,"clip":"cta_price"},{"type":"lead_submit","seq":3,"clip":"form1"}]')::text;
reset role;
select 'prefs: only new_lead allowed -> ' || coalesce(string_agg(type, ','), 'none') from owner_notifications;
update retarget_preferences set in_app = false;
delete from owner_notifications;
set role service_role;
select ingest_video_events('vidRt00001','sess-rt4rt4rt4rt4rt4r',null,null,null,null,'[{"type":"play","seq":1},{"type":"lead_submit","seq":3,"clip":"form1"}]')::text;
reset role;
select 'prefs: in_app off -> ' || count(*) from owner_notifications;
\echo '--- digests and surges (service role)'
update retarget_preferences set in_app = true, enabled_types = array['daily_digest','interest_surge','followup_opportunity'];
update video_analytics_daily set day = current_date - 1;
set role service_role;
select 'digests built: ' || build_daily_digests(false);
select 'digests again (deduped): ' || build_daily_digests(false);
select 'surges: ' || detect_interest_surges();
reset role;
select 'digest notification: ' || title || ' | ' || summary from owner_notifications where type='daily_digest';
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select 'auth digest:'; select build_daily_digests(false);
