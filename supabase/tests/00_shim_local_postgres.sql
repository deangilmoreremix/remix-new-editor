do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
-- Stand-in for the table web_push_notifications.sql creates (the admin-alert trigger reads it); the real migration is not applied locally.
create table if not exists public.push_dispatch_config (id integer primary key check (id = 1), url text, secret text);
