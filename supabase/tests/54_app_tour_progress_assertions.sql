-- Asserting checks for guided-tour progress (20261120100000_app_tour_progress.sql). Runs after 50 in the same database
-- (reuses the t.* helpers). Any failed expectation raises and psql exits non-zero.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

reset role;
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into public.app_tour_progress(tour_id, version) values ('app', 1), ('image', 1);
select t.ok('owner id comes from the token', (select count(*) from public.app_tour_progress where clerk_user_id = 'userA') = 2);
insert into public.app_tour_progress(clerk_user_id, tour_id, version) values ('userA', 'image', 2)
  on conflict (clerk_user_id, tour_id) do update set version = excluded.version, seen_at = now();
select t.ok('upsert bumps the version (what the app does)', (select version from public.app_tour_progress where tour_id = 'image') = 2);

set request.jwt.claims = '{"sub":"userB"}';
select t.ok('B sees no tours of A', (select count(*) from public.app_tour_progress) = 0);
update public.app_tour_progress set version = 99;
delete from public.app_tour_progress;
reset role;
select t.ok('B cannot change or delete A''s rows', (select count(*) from public.app_tour_progress where clerk_user_id = 'userA' and version < 99) = 2);
set role authenticated; set request.jwt.claims = '{"sub":"userB"}';
select t.fails('B cannot insert a row as A', $q$insert into public.app_tour_progress(clerk_user_id, tour_id) values ('userA', 'video')$q$);
insert into public.app_tour_progress(tour_id) values ('__disabled__');
select t.ok('B can record "tours off" for self', (select count(*) from public.app_tour_progress where tour_id = '__disabled__') = 1);
delete from public.app_tour_progress;
select t.ok('B can reset own tours (delete own rows)', (select count(*) from public.app_tour_progress) = 0);
select t.fails('empty tour id is refused', $q$insert into public.app_tour_progress(tour_id) values ('')$q$);
select t.fails('version 0 is refused', $q$insert into public.app_tour_progress(tour_id, version) values ('x', 0)$q$);

reset role;
set role anon; set request.jwt.claims = '{}';
select t.sees_nothing('anon sees no tour rows', 'public.app_tour_progress');
select t.fails('anon cannot insert', $q$insert into public.app_tour_progress(tour_id) values ('app')$q$);
reset role;
\echo ALL APP TOUR ASSERTIONS PASSED
