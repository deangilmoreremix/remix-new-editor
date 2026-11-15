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
create or replace function t.rows_affected(stmt text) returns bigint language plpgsql as $$
declare n bigint; begin execute stmt; get diagnostics n = row_count; return n; end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

-- Stand-ins for the exposed production tables: RLS off, anon/authenticated hold everything (Supabase's default privileges).
create table public.legacy_keys (id serial primary key, secret text);                       -- no policy at all: deny-by-default
create table public.admin_analytics_events (id serial primary key, name text);              -- live anon insert path + existing authenticated policy
create table public.with_policy (id serial primary key, owner text, note text);             -- has its own-row policies (written for RLS, never enabled)
create table public.user_api_keys (id serial primary key, owner text, secret text);         -- keys, with an owner-run view that ignores RLS
create view public.user_api_keys_read as select id, owner, secret from public.user_api_keys;
create table public.already_safe (id serial primary key, owner text);
alter table public.already_safe enable row level security;
create policy own on public.already_safe for select to authenticated using (owner = 'me');
create policy ana_auth_insert on public.admin_analytics_events for insert to authenticated with check (true);
create policy wp_select on public.with_policy for select to authenticated using (owner = current_setting('app.uid', true));
create policy wp_insert on public.with_policy for insert to authenticated with check (owner = current_setting('app.uid', true));
create policy uak_select on public.user_api_keys for select to authenticated using (owner = current_setting('app.uid', true));
grant all on public.legacy_keys, public.admin_analytics_events, public.with_policy, public.user_api_keys, public.user_api_keys_read, public.already_safe to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
insert into public.legacy_keys (secret) values ('sk-1'), ('sk-2');
insert into public.already_safe (owner) values ('me'), ('other');
insert into public.with_policy (owner, note) values ('u1', 'mine'), ('u2', 'theirs');
insert into public.user_api_keys (owner, secret) values ('u1', 'KEY-OF-U1'), ('u2', 'KEY-OF-U2');
set role anon;
select t.ok('before: anon can read every user''s decrypted key through the owner-run view (the hole)', (select count(*) from public.user_api_keys_read) = 2);
reset role;
select t.ok('before: the legacy table is wide open', has_table_privilege('anon', 'public.legacy_keys', 'insert') and not (select relrowsecurity from pg_class where oid = 'public.legacy_keys'::regclass));

\i supabase/migrations/20261120000000_enable_rls_on_exposed_tables.sql

select t.ok('RLS is on for every stand-in and no ordinary public table is left without it', not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and not c.relispartition));
select t.ok('TRUNCATE/REFERENCES/TRIGGER are gone for anon and authenticated on every table the migration handled, policy or not (a table that already had RLS is out of scope)', not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace, unnest(array['anon', 'authenticated']) r where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'already_safe' and (has_table_privilege(r, c.oid, 'truncate') or has_table_privilege(r, c.oid, 'references') or has_table_privilege(r, c.oid, 'trigger'))));
select t.ok('policy-less tables lose INSERT/UPDATE/DELETE but keep SELECT (empty result, not an error)', not has_table_privilege('anon', 'public.legacy_keys', 'insert') and not has_table_privilege('authenticated', 'public.legacy_keys', 'update') and not has_table_privilege('anon', 'public.legacy_keys', 'delete') and has_table_privilege('anon', 'public.legacy_keys', 'select'));
select t.ok('tables WITH policies keep their write grants (so their own policies can work)', has_table_privilege('authenticated', 'public.with_policy', 'insert') and has_table_privilege('authenticated', 'public.admin_analytics_events', 'insert'));

set role anon;
select t.ok('anon reads NOTHING from the legacy table (rows exist, RLS hides them)', (select count(*) from public.legacy_keys) = 0);
select t.fails_with('anon cannot insert into the legacy table', '42501', $$insert into public.legacy_keys (secret) values ('x')$$);
select t.fails_with('anon cannot delete from the legacy table', '42501', $$delete from public.legacy_keys$$);
select t.fails_with('anon cannot update the legacy table', '42501', $$update public.legacy_keys set secret = 'x'$$);
select t.fails_with('anon cannot TRUNCATE a table that has policies either', '42501', $$truncate public.with_policy$$);
select t.fails_with('anon cannot TRUNCATE the legacy table', '42501', $$truncate public.legacy_keys$$);
insert into public.admin_analytics_events (name) values ('page_view');
select t.ok('the live analytics write path still works for anon: the insert above did not fail', true);
select t.ok('...but anon cannot read the analytics rows back', (select count(*) from public.admin_analytics_events) = 0);
select t.ok('...nor update them (0 rows affected: no UPDATE policy, so RLS filters every row)', t.rows_affected($$update public.admin_analytics_events set name = 'x'$$) = 0);
select t.ok('...nor delete them (0 rows affected)', t.rows_affected($$delete from public.admin_analytics_events$$) = 0);
select t.fails_with('the decrypted-keys view is no longer readable by anon', '42501', $$select * from public.user_api_keys_read$$);
select t.ok('anon sees no rows of a table whose policies only name authenticated', (select count(*) from public.with_policy) = 0);
reset role;

set role authenticated;
select set_config('app.uid', 'u1', false);
select t.ok('a table that already had RLS keeps its own policy (authenticated sees only its own row)', (select count(*) from public.already_safe) = 1);
select t.fails_with('authenticated cannot insert into the policy-less legacy table', '42501', $$insert into public.legacy_keys (secret) values ('x')$$);
select t.ok('own-row policies now WORK: u1 sees only their own row', (select count(*) from public.with_policy) = 1 and (select note from public.with_policy) = 'mine');
insert into public.with_policy (owner, note) values ('u1', 'new');
select t.ok('...and u1 can insert their own row', true);
select t.fails_with('...but not a row owned by someone else', '42501', $$insert into public.with_policy (owner, note) values ('u2', 'forged')$$);
select t.ok('the keys view now respects the owner policy: u1 sees only their own key', (select count(*) from public.user_api_keys_read) = 1 and (select secret from public.user_api_keys_read) = 'KEY-OF-U1');
select t.fails_with('authenticated cannot TRUNCATE', '42501', $$truncate public.with_policy$$);
reset role;

set role service_role;
insert into public.legacy_keys (secret) values ('sk-3');
select t.ok('service_role (server code) still reads and writes everything, including the row anon inserted', (select count(*) from public.legacy_keys) = 3 and (select count(*) from public.admin_analytics_events) = 1 and (select count(*) from public.user_api_keys_read) = 2);
reset role;

\i supabase/migrations/20261120000000_enable_rls_on_exposed_tables.sql
select t.ok('running it twice is harmless (policy not duplicated)', (select count(*) from pg_policies where tablename = 'admin_analytics_events' and policyname = 'admin_analytics_events_anon_insert') = 1);
do $$ begin raise notice 'ALL ASSERTIONS PASSED'; end $$;
