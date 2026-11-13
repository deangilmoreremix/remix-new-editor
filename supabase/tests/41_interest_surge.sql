\pset format unaligned
\pset tuples_only on
reset role;
delete from owner_notifications;
-- 6 qualifying sessions this week, 1 last week -> surge (>=5 and >=2x)
insert into video_view_sessions(video_id, revision, session_key, played, started_at)
select 'vidRt00001', 1, 'sess-surge' || lpad(g::text, 10, '0') || 'xxxx', true, now() - interval '2 days' from generate_series(1, 6) g;
insert into video_view_sessions(video_id, revision, session_key, played, started_at)
values ('vidRt00001', 1, 'sess-prevweek00000000x', true, now() - interval '10 days');
insert into viewer_interests(session_id, video_id, interest_key, interest_type, score)
select id, video_id, 'Roof repair', 'service', 40 from video_view_sessions where session_key like 'sess-surge%' or session_key = 'sess-prevweek00000000x';
update retarget_preferences set enabled_types = default;
set role service_role;
select 'surges found: ' || detect_interest_surges();
select 'surges again: ' || detect_interest_surges();
reset role;
select 'rows: ' || string_agg(type || ' [' || interest || '] ' || (metrics::text), ' | ') from owner_notifications;
select 'count: ' || count(*) from owner_notifications;
