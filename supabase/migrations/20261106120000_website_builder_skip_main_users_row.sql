-- Smart Website Builder logins must not insert into public.users.
--
-- public.handle_new_user() runs after every insert into auth.users and adds a
-- row to public.users. That table's clerk_id column is NOT NULL, but the
-- function never supplies it, so as written the insert (and therefore the
-- whole login creation) fails with:
--   null value in column "clerk_id" of relation "users" violates not-null constraint
-- That broke Smart Website Builder sign-in (the first caller to create a
-- Supabase login in this project, since SmartVideo itself signs in with Clerk).
--
-- Builder logins are created by netlify/functions/website-builder-session.js
-- with app_metadata.source = 'smart-website-builder'. app_metadata can only be
-- written server-side with the service role, so users cannot set it
-- themselves. This version returns early for those logins and is otherwise
-- identical to the existing function, so every other path behaves as before.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.raw_app_meta_data ->> 'source' = 'smart-website-builder' then
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
