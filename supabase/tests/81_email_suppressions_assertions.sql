-- Asserting checks for 20261116000000_email_suppressions.sql. Run with supabase/tests/run-email-suppressions-assertions.sh.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create schema if not exists t;
create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; raise notice 'ok - %', label; end $$;
create or replace function t.fails(label text, stmt text) returns void language plpgsql as $$
begin begin execute stmt; exception when others then raise notice 'ok - % (%)', label, left(sqlerrm, 70); return; end; raise exception 'ASSERTION FAILED (statement succeeded): %', label; end $$;
create or replace function t.fails_with(label text, code text, stmt text) returns void language plpgsql as $$
begin begin execute stmt; exception when others then if sqlstate = code then raise notice 'ok - % (%)', label, sqlstate; return; end if; raise exception 'ASSERTION FAILED (wrong error % <> %): % — %', sqlstate, code, label, sqlerrm; end; raise exception 'ASSERTION FAILED (statement succeeded): %', label; end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;

select set_config('t.h1', encode(sha256('ann@example.com'::bytea), 'hex'), false);
select set_config('t.h2', encode(sha256('bob@example.com'::bytea), 'hex'), false);
set role service_role;
select t.ok('adding a suppression reports true the first time', email_suppression_add('userA', current_setting('t.h1'), 'unsubscribed', 'one-click'));
select t.ok('adding it again is a no-op (false), not an error', not email_suppression_add('userA', current_setting('t.h1'), 'manual', 'owner'));
select t.ok('the FIRST reason is kept (an import cannot downgrade an unsubscribe)', (select reason from email_suppression_list('userA') where email_hash = current_setting('t.h1')) = 'unsubscribed');
select t.ok('check returns exactly the suppressed hashes among those asked', email_suppression_check('userA', array[current_setting('t.h1'), current_setting('t.h2')]) = array[current_setting('t.h1')]);
select t.ok('a suppression is PER OWNER: B can still email Ann', email_suppression_check('userB', array[current_setting('t.h1')]) = '{}');
select t.ok('an empty list checks to an empty array', email_suppression_check('userA', '{}') = '{}');
select t.fails_with('more than 5000 hashes is refused', '22023', $q$select email_suppression_check('userA', (select array_agg(repeat('a', 64)) from generate_series(1, 5001)))$q$);
select t.fails_with('a missing owner is refused', '28000', $q$select email_suppression_check('', array[repeat('a', 64)])$q$);
select t.fails('a hash that is not sha-256 hex is refused', $q$select email_suppression_add('userA', 'ann@example.com', 'unsubscribed', 'link')$q$);
select t.fails('an unknown reason is refused', $q$select email_suppression_add('userA', repeat('b', 64), 'because', 'link')$q$);
select t.ok('the list shows only hashes (no address column)', not exists (select 1 from pg_proc p, unnest(p.proargnames) n where p.proname = 'email_suppression_list' and n like '%mail' and n <> 'email_hash'));
select t.ok('B cannot see A''s list', (select count(*) from email_suppression_list('userB')) = 0);
select t.ok('B cannot remove A''s entry', not email_suppression_remove('userB', current_setting('t.h1')));
select t.ok('A removes their entry (the recipient asked to come back)', email_suppression_remove('userA', current_setting('t.h1')));
select t.ok('after removal the address may be emailed again', email_suppression_check('userA', array[current_setting('t.h1')]) = '{}');
select t.ok('removing something that is not there reports false', not email_suppression_remove('userA', current_setting('t.h1')));
reset role; set role anon;
select t.fails('anon cannot read the table', 'select * from public.email_suppressions');
select t.fails('anon cannot call add (a visitor cannot suppress arbitrary addresses)', $q$select email_suppression_add('userA', repeat('c', 64), 'unsubscribed', 'link')$q$);
select t.fails('anon cannot check', $q$select email_suppression_check('userA', array[repeat('c', 64)])$q$);
reset role; set role authenticated; select set_config('request.jwt.claims', '{"sub":"userB"}', false);
select t.fails('a signed-in user cannot read the table directly', 'select * from public.email_suppressions');
select t.fails('a signed-in user cannot call the RPCs directly', $q$select email_suppression_list('userA')$q$);
reset role;
do $$ begin raise notice 'ALL ASSERTIONS PASSED'; end $$;
