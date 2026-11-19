-- Asserting checks for the app-wide onboarding (20261119100000_app_onboarding.sql). Runs after 50 in the same database
-- (reuses the t.* helpers). Any failed expectation raises and psql exits non-zero.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

reset role;
-- ===== user A saves answers; the owner id is taken from the token
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
insert into public.app_onboarding(goal, team_size, videos_per_month, company, website, job_title, heard_from, video_types, tools, primary_tool, step)
  values ('ai-video', '2-5', '100+', 'Acme', 'acme.com', 'AE', 'google', '{talking,cinematic}', '{avatar,video}', 'avatar', 6);
select t.ok('owner id comes from the token', (select clerk_user_id from public.app_onboarding) = 'userA');
select t.ok('A reads own row', (select count(*) from public.app_onboarding) = 1);
update public.app_onboarding set completed_at = now() where clerk_user_id = 'userA';
select t.ok('A can finish own onboarding', (select completed_at is not null from public.app_onboarding));
select t.ok('updated_at is touched on update', (select updated_at >= created_at from public.app_onboarding));
update public.app_onboarding set skipped_at = now(), step = 3, tools = '{image}', primary_tool = 'image' where clerk_user_id = 'userA';
select t.ok('A can redo (new answers overwrite)', (select step = 3 and tools = '{image}' from public.app_onboarding));
insert into public.app_onboarding(clerk_user_id, step) values ('userA', 1) on conflict (clerk_user_id) do update set step = excluded.step;
select t.ok('upsert on the owner id works (what the app does)', (select step = 1 from public.app_onboarding));

-- ===== user B sees and changes nothing of A
set request.jwt.claims = '{"sub":"userB"}';
select t.ok('B sees no rows of A', (select count(*) from public.app_onboarding) = 0);
update public.app_onboarding set company = 'hacked';
reset role;
select t.ok('B cannot update A''s row', (select company from public.app_onboarding where clerk_user_id = 'userA') = 'Acme');
set role authenticated; set request.jwt.claims = '{"sub":"userB"}';
select t.fails('B cannot insert a row as A', $q$insert into public.app_onboarding(clerk_user_id, step) values ('userA', 2)$q$);
select t.fails('B cannot delete (no delete privilege)', $q$delete from public.app_onboarding$q$);
insert into public.app_onboarding(step) values (2);
select t.ok('B gets own row with own id', (select clerk_user_id from public.app_onboarding) = 'userB');

-- ===== constraints
set request.jwt.claims = '{"sub":"userC"}';
select t.fails('unknown goal is refused', $q$insert into public.app_onboarding(goal) values ('nope')$q$);
select t.fails('unknown team size is refused', $q$insert into public.app_onboarding(team_size) values ('huge')$q$);
select t.fails('step above 6 is refused', $q$insert into public.app_onboarding(step) values (7)$q$);
select t.fails('step below 1 is refused', $q$insert into public.app_onboarding(step) values (0)$q$);
select t.fails('overlong company is refused', $q$insert into public.app_onboarding(company) values (repeat('x', 121))$q$);
select t.fails('more than 8 video types is refused', $q$insert into public.app_onboarding(video_types) values ('{a,b,c,d,e,f,g,h,i}')$q$);

-- ===== anonymous (no token) can neither read nor write
reset role;
set role anon; set request.jwt.claims = '{}';
select t.sees_nothing('anon sees no onboarding rows', 'public.app_onboarding');
select t.fails('anon cannot insert', $q$insert into public.app_onboarding(step) values (1)$q$);
reset role;
\echo ALL APP ONBOARDING ASSERTIONS PASSED
