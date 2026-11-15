-- Closes the public-API exposure of tables that had row-level security OFF.
--
-- Problem: tables in `public` without RLS are readable AND writable by anyone holding the public anon key (Supabase grants
-- anon/authenticated all privileges on public tables by default). Found on production: 117 of 314 tables.
--
-- Fix (generic, so it covers every such table without a hand-written list):
--   1. ENABLE ROW LEVEL SECURITY on every ordinary public table that has it off (not partitions, not extension-owned tables).
--      With no policy, anon/authenticated see no rows; service_role and the table owner bypass RLS, so server-side code is unaffected.
--   2. REVOKE INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER from anon and authenticated on those tables (a write now fails cleanly
--      instead of relying on RLS alone). SELECT is left granted: with RLS on it returns no rows (200 + empty) rather than 401, so an
--      app that polls a table does not start erroring.
--   3. Keep the one live anonymous write path found in the API traffic: admin_analytics_events accepts INSERT from anon/authenticated
--      (insert-only: no select, update or delete) via an explicit policy.
-- Idempotent: running it again changes nothing. Roll back with ALTER TABLE ... DISABLE ROW LEVEL SECURITY and re-GRANT if an app breaks.

do $$
declare r record; n integer := 0;
begin
  for r in
    select c.oid, n.nspname, c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and not c.relispartition
       and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('alter table %I.%I enable row level security', r.nspname, r.relname);
    execute format('revoke insert, update, delete, truncate, references, trigger on table %I.%I from anon, authenticated', r.nspname, r.relname);
    n := n + 1;
  end loop;
  raise notice 'enable_rls_on_exposed_tables: secured % table(s)', n;
end $$;

do $$
begin
  if to_regclass('public.admin_analytics_events') is not null then
    grant insert on table public.admin_analytics_events to anon, authenticated;
    drop policy if exists "admin_analytics_events_insert_only" on public.admin_analytics_events;
    create policy "admin_analytics_events_insert_only" on public.admin_analytics_events for insert to anon, authenticated with check (true);
  end if;
end $$;
