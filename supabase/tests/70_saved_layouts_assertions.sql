-- Asserting checks for 20261114000000_personalization_saved_layouts.sql. Any failed expectation raises and psql exits non-zero.
-- Run with supabase/tests/run-layouts-assertions.sh (throwaway local Postgres + the Supabase shim).
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

create schema if not exists t;
create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if;
  raise notice 'ok - %', label;
end $$;
create or replace function t.fails(label text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then raise notice 'ok - % (%)', label, left(sqlerrm, 70); return; end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
-- Expects the statement to raise with exactly this SQLSTATE.
create or replace function t.fails_with(label text, code text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlstate = code then raise notice 'ok - % (%)', label, sqlstate; return; end if;
    raise exception 'ASSERTION FAILED (wrong error % <> %): % — %', sqlstate, code, label, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
-- Runs a DML statement as the current role and returns how many rows it touched (a data-modifying CTE cannot sit in a subquery).
create or replace function t.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

-- Supabase grants service_role (and anon/authenticated) table access through default privileges; the shim does not emulate that.
-- Emulate the service_role part so the checks below can read the table directly as the server would. anon/authenticated are
-- deliberately NOT granted here: the migration must leave them with no access of their own.
grant all on all tables in schema public to service_role;

\set L '{"layers":[{"id":"headline","kind":"headline","x":0.3,"y":0.3,"scale":0.1,"opacity":1,"visible":true,"rotation":15}]}'

-- ===== the server (service_role) saves through the RPCs ==========================================================
set role service_role;
select t.ok('A saves a layout', (select (personalization_saved_layouts_save('userA', 'Corner', :'L'::jsonb)).name) = 'Corner');
select t.ok('B saves one of their own', (select (personalization_saved_layouts_save('userB', 'B only', :'L'::jsonb)).name) = 'B only');
select t.ok('A sees exactly their own layout', (select count(*) from personalization_saved_layouts_list('userA')) = 1);
select t.ok('B sees exactly their own layout', (select count(*) from personalization_saved_layouts_list('userB')) = 1);
select t.ok('A cannot see B''s layout through the list RPC', not exists (select 1 from personalization_saved_layouts_list('userA') where name = 'B only'));

-- Same name (any case/padding) replaces instead of duplicating.
select personalization_saved_layouts_save('userA', '  CORNER ', '{"layers":[{"id":"x","kind":"logo","x":0.1,"y":0.1,"scale":0.2,"opacity":1,"visible":true}]}'::jsonb);
select t.ok('saving under the same name replaces it', (select count(*) from personalization_saved_layouts_list('userA')) = 1);
select t.ok('replacement carries the new layout and the trimmed name', (select layout->'layers'->0->>'id' from personalization_saved_layouts_list('userA')) = 'x');
select t.ok('the same name for another user is a different row', (select count(*) from personalization_saved_layouts) = 2);

-- Identity is mandatory.
select t.fails_with('list needs a user id', '28000', $q$select * from personalization_saved_layouts_list('')$q$);
select t.fails_with('save needs a user id', '28000', $q$select personalization_saved_layouts_save(null, 'x', '{}'::jsonb)$q$);
select t.fails_with('delete needs a user id', '28000', $q$select personalization_saved_layouts_delete(gen_random_uuid(), '')$q$);

-- Delete is owner-only and does not reveal whether someone else's id exists.
select t.ok('B cannot delete A''s layout (returns false)',
  (select personalization_saved_layouts_delete((select id from personalization_saved_layouts where clerk_user_id = 'userA' limit 1), 'userB')) = false);
select t.ok('A''s layout is still there', (select count(*) from personalization_saved_layouts where clerk_user_id = 'userA') = 1);
select t.ok('A can delete their own layout',
  (select personalization_saved_layouts_delete((select id from personalization_saved_layouts where clerk_user_id = 'userA' limit 1), 'userA')) = true);
select t.ok('deleting a missing id returns false', (select personalization_saved_layouts_delete(gen_random_uuid(), 'userA')) = false);

-- ===== column / payload limits ====================================================================================
select t.fails('blank name is rejected', $q$select personalization_saved_layouts_save('userA', '   ', '{}'::jsonb)$q$);
select t.fails('61-character name is rejected', format($q$select personalization_saved_layouts_save('userA', %L, '{}'::jsonb)$q$, repeat('n', 61)));
select t.ok('60-character name is accepted', (select (personalization_saved_layouts_save('userA', repeat('n', 60), '{}'::jsonb)).id) is not null);
select t.fails('a non-object layout is rejected', $q$select personalization_saved_layouts_save('userA', 'arr', '[1,2]'::jsonb)$q$);
select t.fails('a layout over 32 KB is rejected', format($q$select personalization_saved_layouts_save('userA', 'big', %L::jsonb)$q$, '{"pad":"' || repeat('x', 33000) || '"}'));

-- ===== per-user cap of 30 =========================================================================================
select personalization_saved_layouts_save('userC', 'layout ' || g, '{}'::jsonb) from generate_series(1, 30) g;
select t.ok('a user can hold 30 layouts', (select count(*) from personalization_saved_layouts_list('userC')) = 30);
select t.fails_with('the 31st NEW name is refused', '53400', $q$select personalization_saved_layouts_save('userC', 'one too many', '{}'::jsonb)$q$);
select t.ok('replacing an existing name still works at the cap', (select (personalization_saved_layouts_save('userC', 'layout 7', '{"layers":[]}'::jsonb)).name) = 'layout 7');
select t.ok('another user is unaffected by C''s cap', (select (personalization_saved_layouts_save('userB', 'second', '{}'::jsonb)).name) = 'second');

-- ===== browser roles can NOT use the RPCs or the table ============================================================
reset role; set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.fails('authenticated cannot call list', $q$select * from personalization_saved_layouts_list('userA')$q$);
select t.fails('authenticated cannot call save', $q$select personalization_saved_layouts_save('userA', 'x', '{}'::jsonb)$q$);
select t.fails('authenticated cannot call delete', $q$select personalization_saved_layouts_delete(gen_random_uuid(), 'userA')$q$);
select t.fails('authenticated has no direct table access (select)', $q$select count(*) from personalization_saved_layouts$q$);
select t.fails('authenticated has no direct table access (insert)', $q$insert into personalization_saved_layouts(clerk_user_id,name,layout) values ('userA','direct','{}')$q$);
reset role; set role anon; reset request.jwt.claims;
select t.fails('anon cannot call list', $q$select * from personalization_saved_layouts_list('userA')$q$);
select t.fails('anon cannot read the table', $q$select count(*) from personalization_saved_layouts$q$);

-- ===== the RLS policies themselves (defence in depth) =============================================================
-- Supabase's default privileges would grant table access to authenticated; the migration revokes it. Re-grant it here to prove the
-- POLICIES alone still isolate users if that ever changes.
reset role;
grant select, insert, update, delete on table personalization_saved_layouts to authenticated;
set role authenticated; set request.jwt.claims = '{"sub":"userA"}';
select t.ok('RLS: A sees only A''s rows', (select count(*) from personalization_saved_layouts where clerk_user_id <> 'userA') = 0 and (select count(*) from personalization_saved_layouts) >= 1);
select t.fails('RLS: A cannot insert a row for B', $q$insert into personalization_saved_layouts(clerk_user_id,name,layout) values ('userB','forged','{}')$q$);
select t.ok('RLS: A can insert their own row', t.affected($q$insert into personalization_saved_layouts(clerk_user_id,name,layout) values ('userA','rls own','{}')$q$) = 1);
set request.jwt.claims = '{"sub":"userB"}';
select t.ok('RLS: B sees none of A''s rows', (select count(*) from personalization_saved_layouts where clerk_user_id = 'userA') = 0);
select t.ok('RLS: B cannot update A''s row (0 rows)', t.affected($q$update personalization_saved_layouts set name = 'hijack' where clerk_user_id = 'userA'$q$) = 0);
select t.ok('RLS: B cannot delete A''s row (0 rows)', t.affected($q$delete from personalization_saved_layouts where clerk_user_id = 'userA'$q$) = 0);
select t.fails('RLS: B cannot move their row to A', $q$update personalization_saved_layouts set clerk_user_id = 'userA' where clerk_user_id = 'userB'$q$);
set request.jwt.claims = '{}';
select t.ok('RLS: a token with no subject sees nothing (fails closed)', (select count(*) from personalization_saved_layouts) = 0);
reset role;
revoke all on table personalization_saved_layouts from authenticated;

select t.ok('A''s rows are intact after all of that', (select count(*) from personalization_saved_layouts where clerk_user_id = 'userA' and name = 'hijack') = 0);
\echo ALL ASSERTIONS PASSED
