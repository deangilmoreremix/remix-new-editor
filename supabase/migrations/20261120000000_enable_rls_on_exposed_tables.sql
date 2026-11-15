-- Closes the public-API exposure of tables that had row-level security OFF.
--
-- Problem: tables in `public` without RLS are readable AND writable by anyone holding the public anon key (Supabase grants
-- anon/authenticated all privileges on public tables by default). Found on production: 117 of 314 tables.
--
-- Fix (generic, so it covers every such table without a hand-written list):
--   1. ENABLE ROW LEVEL SECURITY on every ordinary public table that has it off (not partitions, not extension-owned tables).
--      Policies that already exist on a table (own-row, admin) start to apply; with no policy, anon/authenticated see no rows.
--      service_role and the table owner bypass RLS, so server-side code is unaffected.
--   2. REVOKE TRUNCATE, REFERENCES, TRIGGER from anon/authenticated on those tables: RLS does not govern them (TRUNCATE ignores RLS).
--   3. On tables with NO policy at all (deny-by-default tables), also REVOKE INSERT/UPDATE/DELETE, so a write fails cleanly. Tables that
--      already have policies keep their write grants, otherwise their own-row/admin policies could never work. SELECT stays granted
--      everywhere: with RLS on it returns no rows (200 + empty) rather than 401, so an app that polls a table does not start erroring.
--   4. The view user_api_keys_read runs as its owner (ignores RLS) and returns DECRYPTED api keys: make it security_invoker so the base
--      table's own-row policy applies, and take it away from anon.
--   5. Keep the one live anonymous write path found in the API traffic (146 POSTs/day, all with the anon role): admin_analytics_events
--      accepts INSERT from anon (insert-only; the existing policies for authenticated are left alone).
-- Idempotent. Roll back with ALTER TABLE ... DISABLE ROW LEVEL SECURITY and re-GRANT if an app breaks.

do $$
declare r record; n integer := 0; w integer := 0;
begin
  for r in
    select c.oid, n.nspname, c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and not c.relispartition
       and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
  loop
    execute format('alter table %I.%I enable row level security', r.nspname, r.relname);
    execute format('revoke truncate, references, trigger on table %I.%I from anon, authenticated', r.nspname, r.relname);
    if not exists (select 1 from pg_policy p where p.polrelid = r.oid) then
      execute format('revoke insert, update, delete on table %I.%I from anon, authenticated', r.nspname, r.relname);
      w := w + 1;
    end if;
    n := n + 1;
  end loop;
  raise notice 'enable_rls_on_exposed_tables: secured % table(s), % of them deny-by-default (no policy)', n, w;
end $$;

do $$
begin
  if to_regclass('public.user_api_keys_read') is not null then
    alter view public.user_api_keys_read set (security_invoker = true);
    revoke all on table public.user_api_keys_read from anon;
  end if;
end $$;

do $$
begin
  if to_regclass('public.admin_analytics_events') is not null then
    grant insert on table public.admin_analytics_events to anon;
    drop policy if exists "admin_analytics_events_anon_insert" on public.admin_analytics_events;
    create policy "admin_analytics_events_anon_insert" on public.admin_analytics_events for insert to anon with check (true);
  end if;
end $$;
