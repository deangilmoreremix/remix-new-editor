-- Asserting checks for 20261121000000_restrict_public_function_access.sql. Run with supabase/tests/run-restrict-function-access-assertions.sh.
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

-- Stand-ins for production's SECURITY DEFINER functions. Supabase's default privileges give anon/authenticated/service_role EXECUTE on every
-- new function; mimic that with explicit grants.
create function public.restore_subscription_access(p_user_id uuid, p_app_slug text) returns boolean language sql security definer as $$ select true $$;
create function public.set_config(setting text, value text, is_local boolean default true) returns void language sql security definer as $$ select 1 $$;
create function public.get_ai_app_usage(user_uuid uuid) returns integer language sql security definer as $$ select 1 $$;
create function public.has_feature(p_feature_key text) returns boolean language sql security definer as $$ select true $$;
create function public.has_feature(p_feature_key text, p_other text) returns boolean language sql security definer as $$ select true $$;   -- an overload
create function public.get_published_video(p_id text) returns text language sql security definer as $$ select p_id $$;                       -- must stay public
create function public.log_failed_login(p_email text) returns void language sql security definer as $$ select 1 $$;                           -- must stay public
create function public.user_has_permission(user_id_param uuid, permission_param text) returns boolean language sql security definer as $$ select true $$; -- used by a policy
create function public.get_tenant_id() returns uuid language sql security definer as $$ select '00000000-0000-0000-0000-000000000001'::uuid $$; -- used as a column default
create function public.handle_new_user() returns trigger language plpgsql security definer as $$ begin new.touched := true; return new; end $$;  -- trigger function
create function public.not_security_definer(p_x int) returns int language sql as $$ select p_x $$;                                            -- invoker function, not in scope
grant execute on all functions in schema public to anon, authenticated, service_role;

create table public.zz_pol (id serial primary key, note text);
alter table public.zz_pol enable row level security;
create policy zz_pol_read on public.zz_pol for select to anon, authenticated using (public.user_has_permission(gen_random_uuid(), 'x'));
insert into public.zz_pol (note) values ('visible');
create table public.zz_def (id serial primary key, tenant uuid default public.get_tenant_id());
create table public.zz_trg (id serial primary key, touched boolean default false);
create trigger zz_trg_touch before insert on public.zz_trg for each row execute function public.handle_new_user();
grant all on public.zz_pol, public.zz_def, public.zz_trg to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

create table public.zz_cf (id serial primary key, owner text, account_email text);
alter table public.zz_cf enable row level security;
create policy zz_cf_own on public.zz_cf for select to authenticated using (owner = current_setting('app.uid', true));
create view public.user_cloudflare_status as select id, owner, account_email from public.zz_cf;     -- owner-run view: ignores the table's RLS
grant all on public.zz_cf, public.user_cloudflare_status to anon, authenticated, service_role;
insert into public.zz_cf (owner, account_email) values ('u1', 'one@example.com'), ('u2', 'two@example.com');
set role anon;
select t.ok('before: anon reads every user''s Cloudflare account email through the owner-run view (the hole)', (select count(*) from public.user_cloudflare_status) = 2);
reset role;
select t.ok('before: anon can call the dangerous function', has_function_privilege('anon', 'public.restore_subscription_access(uuid,text)', 'execute') and has_function_privilege('anon', 'public.set_config(text,text,boolean)', 'execute'));

\i supabase/migrations/20261121000000_restrict_public_function_access.sql

select t.ok('server-only functions: gone for anon AND authenticated', not has_function_privilege('anon', 'public.restore_subscription_access(uuid,text)', 'execute') and not has_function_privilege('authenticated', 'public.restore_subscription_access(uuid,text)', 'execute') and not has_function_privilege('anon', 'public.set_config(text,text,boolean)', 'execute') and not has_function_privilege('authenticated', 'public.set_config(text,text,boolean)', 'execute'));
select t.ok('signed-in functions: gone for anon, kept for authenticated (both overloads)', not has_function_privilege('anon', 'public.get_ai_app_usage(uuid)', 'execute') and has_function_privilege('authenticated', 'public.get_ai_app_usage(uuid)', 'execute') and not has_function_privilege('anon', 'public.has_feature(text)', 'execute') and not has_function_privilege('anon', 'public.has_feature(text,text)', 'execute') and has_function_privilege('authenticated', 'public.has_feature(text,text)', 'execute'));
select t.ok('service_role keeps EXECUTE on every restricted function', has_function_privilege('service_role', 'public.restore_subscription_access(uuid,text)', 'execute') and has_function_privilege('service_role', 'public.set_config(text,text,boolean)', 'execute') and has_function_privilege('service_role', 'public.get_ai_app_usage(uuid)', 'execute') and has_function_privilege('service_role', 'public.handle_new_user()', 'execute'));
select t.ok('public-page and login-logging functions are NOT touched', has_function_privilege('anon', 'public.get_published_video(text)', 'execute') and has_function_privilege('anon', 'public.log_failed_login(text)', 'execute'));
select t.ok('a function a POLICY calls is left alone (anon still has EXECUTE even though it is on the signed-in list)', has_function_privilege('anon', 'public.user_has_permission(uuid,text)', 'execute') and has_function_privilege('authenticated', 'public.user_has_permission(uuid,text)', 'execute'));
select t.ok('a function used as a column DEFAULT is left alone', has_function_privilege('anon', 'public.get_tenant_id()', 'execute') and has_function_privilege('authenticated', 'public.get_tenant_id()', 'execute'));
select t.ok('a function that is not SECURITY DEFINER is out of scope', has_function_privilege('anon', 'public.not_security_definer(int)', 'execute'));
select t.ok('trigger functions lose anon/authenticated EXECUTE', not has_function_privilege('anon', 'public.handle_new_user()', 'execute') and not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'));

set role anon;
select t.fails_with('anon calling restore_subscription_access is refused', '42501', $$select public.restore_subscription_access(gen_random_uuid(), 'x')$$);
select t.fails_with('anon calling set_config is refused', '42501', $$select public.set_config('app.clerk_user_id', 'victim', false)$$);
select t.fails_with('anon calling a signed-in function is refused', '42501', $$select public.get_ai_app_usage(gen_random_uuid())$$);
select t.ok('anon can still call a public-page function', public.get_published_video('abc') = 'abc');
select t.ok('anon queries a table whose policy calls a restricted-list function: still works (no permission denied)', (select count(*) from public.zz_pol) = 1);
insert into public.zz_def default values;
select t.ok('anon insert using a default function still works', true);
reset role;

set role authenticated;
select t.fails_with('authenticated calling a server-only function is refused', '42501', $$select public.restore_subscription_access(gen_random_uuid(), 'x')$$);
select t.ok('authenticated can still call a signed-in function', public.get_ai_app_usage(gen_random_uuid()) = 1);
insert into public.zz_trg default values;
select t.ok('a trigger function still fires when a role without EXECUTE inserts', (select touched from public.zz_trg limit 1) is true);
reset role;

set role anon;
select t.fails_with('the Cloudflare status view is no longer readable by anon', '42501', $$select * from public.user_cloudflare_status$$);
reset role;
set role authenticated;
select set_config('app.uid', 'u1', false);
select t.ok('...and for a signed-in user it respects the table''s own-row policy (sees only their own row)', (select count(*) from public.user_cloudflare_status) = 1 and (select account_email from public.user_cloudflare_status) = 'one@example.com');
reset role;
set role service_role;
select t.ok('service_role can call server-only functions', public.restore_subscription_access(gen_random_uuid(), 'x') is true);
reset role;

\i supabase/migrations/20261121000000_restrict_public_function_access.sql
select t.ok('running it twice changes nothing', not has_function_privilege('anon', 'public.restore_subscription_access(uuid,text)', 'execute') and has_function_privilege('authenticated', 'public.get_ai_app_usage(uuid)', 'execute'));
do $$ begin raise notice 'ALL ASSERTIONS PASSED'; end $$;
