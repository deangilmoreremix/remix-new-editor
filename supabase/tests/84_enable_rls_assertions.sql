-- Asserting checks for 20261120000000_enable_rls_on_exposed_tables.sql. Run with supabase/tests/run-enable-rls-assertions.sh.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create schema if not exists t;
create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; raise notice 'ok - %', label; end $$;
create or replace function t.fails_with(label text, code text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlstate = code then raise notice 'ok - % (%)', label, sqlstate; return; end if;
    raise exception 'ASSERTION FAILED (wrong error % <> %): % — %', sqlstate, code, label, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

-- Stand-ins for the exposed production tables: RLS off, anon/authenticated hold everything (Supabase's default privileges).
create table public.legacy_keys (id serial primary key, secret text);
create table public.admin_analytics_events (id serial primary key, name text);
create table public.already_safe (id serial primary key, owner text);
alter table public.already_safe enable row level security;
create policy own on public.already_safe for select to authenticated using (owner = 'me');
grant all on public.legacy_keys, public.admin_analytics_events, public.already_safe to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
insert into public.legacy_keys (secret) values ('sk-1'), ('sk-2');
insert into public.already_safe (owner) values ('me'), ('other');
select t.ok('before: the legacy table is wide open', has_table_privilege('anon', 'public.legacy_keys', 'insert') and not (select relrowsecurity from pg_class where oid = 'public.legacy_keys'::regclass));

\i supabase/migrations/20261120000000_enable_rls_on_exposed_tables.sql

select t.ok('RLS is now on for both stand-ins and no ordinary public table is left without it', (select relrowsecurity from pg_class where oid = 'public.legacy_keys'::regclass) and (select relrowsecurity from pg_class where oid = 'public.admin_analytics_events'::regclass) and not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and not c.relispartition));
select t.ok('anon and authenticated lost write privileges on the legacy table but keep SELECT (so readers get an empty result, not an error)', not has_table_privilege('anon', 'public.legacy_keys', 'insert') and not has_table_privilege('authenticated', 'public.legacy_keys', 'update') and not has_table_privilege('anon', 'public.legacy_keys', 'delete') and not has_table_privilege('anon', 'public.legacy_keys', 'truncate') and has_table_privilege('anon', 'public.legacy_keys', 'select'));

set role anon;
select t.ok('anon reads NOTHING from the legacy table (rows exist, RLS hides them)', (select count(*) from public.legacy_keys) = 0);
select t.fails_with('anon cannot insert into the legacy table', '42501', $$insert into public.legacy_keys (secret) values ('x')$$);
select t.fails_with('anon cannot delete from the legacy table', '42501', $$delete from public.legacy_keys$$);
select t.fails_with('anon cannot update the legacy table', '42501', $$update public.legacy_keys set secret = 'x'$$);
insert into public.admin_analytics_events (name) values ('page_view');
select t.ok('the live analytics write path still works for anon (insert-only): the insert above did not fail', true);
select t.ok('...but anon cannot read the analytics rows back', (select count(*) from public.admin_analytics_events) = 0);
select t.fails_with('...nor update them', '42501', $$update public.admin_analytics_events set name = 'x'$$);
select t.fails_with('...nor delete them', '42501', $$delete from public.admin_analytics_events$$);
reset role;
set role authenticated;
select t.ok('a table that already had RLS keeps its own policy (authenticated sees only its own row)', (select count(*) from public.already_safe) = 1);
select t.fails_with('authenticated cannot insert into the legacy table', '42501', $$insert into public.legacy_keys (secret) values ('x')$$);
reset role;
set role service_role;
insert into public.legacy_keys (secret) values ('sk-3');
select t.ok('service_role (server code) still reads and writes everything, including the row anon inserted', (select count(*) from public.legacy_keys) = 3 and (select count(*) from public.admin_analytics_events) = 1);
reset role;

-- Idempotent: a second run changes nothing and does not fail.
\i supabase/migrations/20261120000000_enable_rls_on_exposed_tables.sql
select t.ok('running it twice is harmless (policy not duplicated)', (select count(*) from pg_policies where tablename = 'admin_analytics_events') = 1);
do $$ begin raise notice 'ALL ASSERTIONS PASSED'; end $$;
