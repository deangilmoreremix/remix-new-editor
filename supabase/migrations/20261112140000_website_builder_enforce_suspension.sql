-- Builder suspension must apply to sessions that already exist, not only to the
-- SSO sign-in. The flag lives on wb_profiles (the shared auth account is the
-- person's SmartVideo login and is never banned). Restrictive policies are
-- AND-ed with the existing permissive ones, so a suspended user loses direct
-- database access to builder data while everything else stays as it was.

create or replace function public.wb_is_suspended()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select suspended from public.wb_profiles where id = auth.uid()), false)
$$;
revoke all on function public.wb_is_suspended() from public, anon;
grant execute on function public.wb_is_suspended() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'wb_projects', 'wb_project_collaborators', 'wb_provider_keys',
    'wb_community_posts', 'wb_community_likes',
    'wb_project_backends', 'wb_project_migrations'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_not_suspended', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (not public.wb_is_suspended()) with check (not public.wb_is_suspended())',
      t || '_not_suspended', t);
  end loop;
end $$;

-- Preview uploads to storage (a shared table, so no restrictive policy here).
drop policy if exists wb_deployments_insert on storage.objects;
create policy wb_deployments_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'wb-deployments'
    and not public.wb_is_suspended()
    and (storage.foldername(name))[1] = 'previews'
    and (public.wb_current_user_is_owner(((storage.foldername(name))[2])::uuid)
         or public.wb_current_user_has_edit_permission(((storage.foldername(name))[2])::uuid))
  );
