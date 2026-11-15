-- Smart Website Builder: unforgeable proof that lets builder logins skip the
-- main app's public.users insert. Supersedes the `source` marker in
-- 20261106120000_website_builder_skip_main_users_row.sql.
--
-- Background
-- public.handle_new_user() runs after every insert into auth.users and adds a
-- public.users row, but never supplies public.users.clerk_id (NOT NULL), so
-- creating ANY new Supabase login in this project fails with:
--   null value in column "clerk_id" of relation "users" violates not-null constraint
-- Smart Website Builder logins are created by
-- netlify/functions/website-builder-session.js and hit that error.
--
-- Why the earlier marker did not work
-- Supabase's admin API writes app_metadata in a second step, after the
-- auth.users row (and therefore this trigger) already ran. user_metadata IS on
-- the row at insert time, but anyone can set it when signing up. This trigger
-- currently also blocks every other new Supabase signup (email and anonymous)
-- in this shared project, so a forgeable marker would silently switch all of
-- them on.
--
-- This version
-- The trigger skips the public.users insert only when
--   raw_user_meta_data ->> 'wb_login_proof'
--     = hex(HMAC-SHA256(login_secret, lower(email)))
-- where login_secret lives in a private table that only the service role can
-- read. Only the server can compute the proof, and each proof is valid for one
-- email address only. Every other login behaves exactly as before.
--
-- Idempotent. The secret is generated inside the database and never appears in
-- git; re-running keeps the existing secret.

create table if not exists public.wb_private_config (
  key text primary key,
  value text not null
);
alter table public.wb_private_config enable row level security;
-- No policies: with RLS on, only roles that bypass it (service_role, postgres) can read.
revoke all on table public.wb_private_config from public, anon, authenticated;

insert into public.wb_private_config (key, value)
values ('login_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.email is not null
     and new.raw_user_meta_data ->> 'wb_login_proof' is not null
     and new.raw_user_meta_data ->> 'wb_login_proof' = encode(
           extensions.hmac(
             lower(new.email),
             (select c.value from public.wb_private_config c where c.key = 'login_secret'),
             'sha256'
           ),
           'hex'
         )
  then
    return new;
  end if;

  insert into public.users (id, email, name, image, role, has_access)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'avatar_url',
    'USER',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
