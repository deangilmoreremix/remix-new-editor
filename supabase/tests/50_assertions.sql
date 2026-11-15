-- Asserting security/behaviour checks. Any failed expectation raises an exception and psql exits non-zero
-- (ON_ERROR_STOP). Run with supabase/tests/run-assertions.sh against a fresh database.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

create schema if not exists t;
create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if;
  raise notice 'ok - %', label;
end $$;
-- Expects the statement to raise (RLS violation, permission denied, check violation, custom exception ...).
create or replace function t.fails(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok - % (%)', label, left(sqlerrm, 60); return; end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
create or replace function t.sees_nothing(label text, tbl text) returns void language plpgsql as $$
declare n bigint;
begin
  begin execute format('select count(*) from %s', tbl) into n; exception when others then raise notice 'ok - % (denied)', label; return; end;
  if n <> 0 then raise exception 'ASSERTION FAILED (% rows visible): %', n, label; end if;
  raise notice 'ok - % (0 rows)', label;
end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

-- ===== owner A creates data
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into timeline_projects(id,name,data) values ('11111111-1111-1111-1111-111111111111','A project','{"timelineSeconds":20}');
select t.ok('owner id is taken from the token', (select clerk_user_id from timeline_projects) = 'userA');
select t.fails('forged clerk_user_id on insert is rejected', $q$insert into timeline_projects(clerk_user_id,name) values ('userB','forged')$q$);
insert into published_videos(id,title,project,project_id) values
  ('vidA000001','Promo','{"timelineSeconds":20,"tracks":[{"items":[{"id":"lf","type":"lead-form","webhookUrl":"https://hook.example/a","notificationEmail":"owner@x.com"}]}]}','11111111-1111-1111-1111-111111111111');
select t.ok('claim business slug', claim_business_slug('acme-roofing','Acme') is not null);
select t.ok('set video slug', set_video_slug('vidA000001','spring-promo') is not null);

-- ===== owner B cannot see or touch A's data
set request.jwt.claims = '{"sub":"userB"}';
select t.ok('B sees no projects of A', (select count(*) from timeline_projects) = 0);
select t.ok('B sees no published videos of A', (select count(*) from published_videos) = 0);
select t.ok('B sees no revisions of A', (select count(*) from published_video_revisions) = 0);
update timeline_projects set name='hijack' where id='11111111-1111-1111-1111-111111111111';
update published_videos set title='hijack' where id='vidA000001';
delete from timeline_projects where id='11111111-1111-1111-1111-111111111111';
select t.fails('B cannot attach a video to A''s project', $q$insert into published_videos(id,title,project,project_id) values ('vidB000099','x','{}','11111111-1111-1111-1111-111111111111')$q$);
select t.fails('B cannot take A''s business slug', $q$select claim_business_slug('acme-roofing')$q$);
select t.fails('B cannot set a slug on A''s video', $q$select set_video_slug('vidA000001','stolen')$q$);
select t.fails('reserved business name', $q$select claim_business_slug('admin')$q$);
select t.fails('invalid slug', $q$select claim_business_slug('A')$q$);
insert into published_videos(id,title,project) values ('vidB000001','B video','{"timelineSeconds":10,"tracks":[]}');
select t.ok('B can publish own video', (select count(*) from published_videos) = 1);

-- ===== A's data unchanged
set request.jwt.claims = '{"sub":"userA"}';
select t.ok('A project name untouched by B', (select name from timeline_projects) = 'A project');
select t.ok('A video title untouched by B', (select title from published_videos where id='vidA000001') = 'Promo');
update timeline_projects set clerk_user_id='userB' where id='11111111-1111-1111-1111-111111111111';
select t.ok('owner cannot be reassigned', (select clerk_user_id from timeline_projects) = 'userA');

-- ===== anonymous
set role anon; set request.jwt.claims = '{}';
select t.sees_nothing('anon cannot read projects','timeline_projects');
select t.sees_nothing('anon cannot list published_videos (no enumeration)','published_videos');
select t.sees_nothing('anon cannot read events','video_events');
select t.sees_nothing('anon cannot read sessions','video_view_sessions');
select t.sees_nothing('anon cannot read notifications','owner_notifications');
select t.fails('anon cannot call ingest_video_events', $q$select ingest_video_events('vidA000001','sess-aaaaaaaaaaaaaaaa',null,null,null,null,'[]')$q$);
select t.ok('public read returns the video', (get_published_video(null,'acme-roofing','spring-promo')->>'id') = 'vidA000001');
select t.ok('public payload has no owner id', not (get_published_video('vidA000001') ? 'clerk_user_id'));
select t.ok('public payload has no webhook / email secrets', get_published_video('vidA000001')::text !~* 'hook\.example|owner@x');
select t.ok('unknown url is null', get_published_video(null,'acme-roofing','nope') is null);

-- ===== signed-in users also cannot ingest (service role only)
set role authenticated; set request.jwt.claims = '{"sub":"userB"}';
select t.fails('authenticated cannot call ingest_video_events', $q$select ingest_video_events('vidA000001','sess-aaaaaaaaaaaaaaaa',null,null,null,null,'[]')$q$);

-- ===== analytics through the real ingest, then owner isolation of the read RPCs
reset role; set role service_role;
select t.ok('ingest accepted', (ingest_video_events('vidA000001','sess-aaaaaaaaaaaaaaaa','abcdef0123456789abcdef0123456789',null,'desktop','example.com',
  '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0},{"type":"cta_click","seq":2,"clip":"lf"}]')->>'accepted')::int = 3);
select t.ok('retry is idempotent (no duplicates)', (ingest_video_events('vidA000001','sess-aaaaaaaaaaaaaaaa',null,null,null,null,
  '[{"type":"page_open","seq":0},{"type":"play","seq":1,"t":0}]')->>'duplicates')::int = 2);
select t.ok('unknown video rejected', coalesce(ingest_video_events('nopenope12','sess-aaaaaaaaaaaaaaaa',null,null,null,null,'[]')->>'ok','false') <> 'true');
select t.ok('event types are an allowlist', coalesce((ingest_video_events('vidA000001','sess-bbbbbbbbbbbbbbbb',null,null,null,null,'[{"type":"bogus","seq":0}]')->>'accepted')::int,0) = 0);
select t.ok('26 events in one batch rejected', coalesce(ingest_video_events('vidA000001','sess-cccccccccccccccc',null,null,null,null,
  (select jsonb_agg(jsonb_build_object('type','pause','seq',g)) from generate_series(1,26) g))->>'ok','false') <> 'true');
select ingest_video_events('vidA000001','sess-dddddddddddddddd','1234567890abcdef1234567890abcdef',null,'mobile',null,'[{"type":"page_open","seq":0},{"type":"play","seq":1},{"type":"lead_submit","seq":2}]');
reset role;
select t.ok('exactly two plays stored (one per session)', (select count(*) from video_events where type='play') = 2);

set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('owner A sees own plays', (video_analytics_summary('vidA000001', current_date - 1, current_date + 1)->>'plays')::int = 2);
select t.ok('owner A sees own notification', (select count(*) from owner_notifications) >= 1);
set request.jwt.claims = '{"sub":"userB"}';
select t.ok('owner B gets no data for A''s video', coalesce((video_analytics_summary('vidA000001', current_date - 1, current_date + 1)->>'plays')::int,0) = 0);
select t.ok('owner B sees none of A''s events', (select count(*) from video_events) = 0);
select t.ok('owner B sees none of A''s notifications', (select count(*) from owner_notifications) = 0);
select t.ok('owner B portfolio excludes A''s plays', coalesce((owner_portfolio_summary(current_date - 1, current_date + 1)->>'plays')::int,0) = 0);
select t.fails('owner B cannot delete A''s analytics', $q$select delete_video_analytics('vidA000001')$q$);
set request.jwt.claims = '{"sub":"userA"}';
select t.ok('A analytics survive B''s delete attempt', (select count(*) from video_events) > 0);
select delete_video_analytics('vidA000001');
select t.ok('A events are gone after delete', (select count(*) from video_events) = 0);

reset role;
select t.ok('app tables are labelled for this application', (select count(*) from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname in ('timeline_projects','video_events','video_view_sessions','owner_notifications','published_videos') and obj_description(c.oid) like '[smartvideo-timeline-editor]%') = 5);
select t.ok('app functions are labelled for this application', obj_description('public.get_published_video(text,text,text)'::regprocedure) like '[smartvideo-timeline-editor]%');
\echo ALL ASSERTIONS PASSED
