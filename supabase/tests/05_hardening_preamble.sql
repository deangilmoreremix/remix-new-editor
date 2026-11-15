-- Simulates, on plain local Postgres, the hardening that the LIVE Supabase project has and this repo does not
-- (migrations 'restrict_public_function_access', 'rls_stage1_deny_by_default', 'rls_stage2_tables_with_policies_and_analytics_insert'
-- and the default-privilege change that makes new public tables/functions private).
-- Applied by run-*.sh when HARDEN=1, AFTER the older migrations and BEFORE the heatmap migration, so the heatmap migration
-- must work with nothing but its own explicit GRANT / REVOKE / ENABLE ROW LEVEL SECURITY statements.
-- 1. Start from the Supabase baseline (new objects in public are granted to the API roles by default) ...
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
-- 2. ... then the hardening: new tables/functions/sequences are private by default.
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;
alter default privileges revoke execute on functions from public;
-- 3. restrict_public_function_access: the live project removes PUBLIC/anon EXECUTE from public functions. Not simulated on the
--    functions of the older migrations (some, e.g. slug_is_valid used in a CHECK, legitimately rely on PUBLIC EXECUTE and the live
--    project handled them in its own migrations, which are not in this repo). What matters for the heatmap migration is covered by
--    step 2 and the global default above: every function it creates starts with NO PUBLIC execute and must GRANT what it needs.
-- 4. rls_stage1_deny_by_default: every existing table has RLS enabled (their policies from the earlier migrations stay).
do $$ declare r record; begin
  for r in select format('%I.%I', schemaname, tablename) as t from pg_tables where schemaname = 'public'
  loop execute format('alter table %s enable row level security', r.t); end loop;
end $$;
