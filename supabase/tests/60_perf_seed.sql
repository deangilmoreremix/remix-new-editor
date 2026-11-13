\set ON_ERROR_STOP on
set session_replication_role = replica;
insert into published_videos(id,title,project,clerk_user_id)
select 'perfvid' || lpad(g::text,3,'0'),'Perf '||g,'{"timelineSeconds":60,"tracks":[]}','userP' from generate_series(1,5) g;
insert into video_view_sessions(video_id,session_key,viewer_hash,device_class,is_return,played,completed,watch_seconds,max_progress,covered,event_count,started_at,last_event_at)
select 'perfvid'||lpad((1+g%5)::text,3,'0'), 'sess' || lpad(g::text,20,'0'), md5((g%40000)::text) , (array['mobile','desktop','tablet'])[1+g%3], g%7=0, g%10<8, g%10<3, (g%60)::numeric, (g%100)/100.0,
  (select array_agg(x::smallint) from generate_series(0,(g%20)) x), 6, ts, ts
from (select g, now() - ((g%90) || ' days')::interval - ((g%1440) || ' minutes')::interval ts from generate_series(1,100000) g) s;
insert into video_events(session_id,video_id,seq,type,t,created_at)
select s.id, s.video_id, e.n, (array['page_open','play','progress_25','pause','cta_click','complete'])[e.n+1], e.n*3, s.started_at
from video_view_sessions s cross join generate_series(0,5) e(n);
insert into video_analytics_daily(video_id,day,page_visits,plays,sessions,completes,cta_clicks,watch_seconds)
select video_id, started_at::date, count(*), count(*) filter (where played), count(*), count(*) filter (where completed), count(*)/5, sum(watch_seconds) from video_view_sessions group by 1,2;
insert into video_daily_viewers select distinct video_id, started_at::date, viewer_hash from video_view_sessions where viewer_hash is not null;
analyze;
select (select count(*) from video_view_sessions) sessions, (select count(*) from video_events) events, (select count(*) from video_analytics_daily) daily;
