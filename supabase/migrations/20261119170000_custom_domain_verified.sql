-- ===========================================================================
-- custom_domain_verified.sql
--
-- Follow-up to 20261119150000_video_owner_custom_domain.sql.
--
-- A hostname typed by an owner is only a request. Anyone could otherwise claim a
-- domain they do not own (squatting it, or, if it is already an alias of the
-- hosting site, remapping that host's pages to their video). The domain now
-- serves only after an administrator attaches it to the hosting site and marks
-- it verified, which no API role can do:
--
--   update public.video_owner_profiles set custom_domain_verified = true
--    where custom_domain = 'videos.acme.com';
--
-- Changing or clearing the domain resets the flag. resolve_custom_domain()
-- returns a business only for a verified domain.
-- ===========================================================================

alter table public.video_owner_profiles
  add column if not exists custom_domain_verified boolean not null default false;

-- API roles read their own row through RLS; make sure none of them can write the flag.
revoke update (custom_domain_verified) on public.video_owner_profiles from anon, authenticated;

create or replace function public.set_custom_domain(p_domain text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me text := auth.jwt() ->> 'sub';
  d text := nullif(lower(btrim(coalesce(p_domain, ''))), '');
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if not exists (select 1 from public.video_owner_profiles where clerk_user_id = me) then
    raise exception 'business_required' using errcode = '22023';
  end if;
  begin
    update public.video_owner_profiles
       set custom_domain = d,
           custom_domain_verified = case when custom_domain is not distinct from d then custom_domain_verified else false end,
           updated_at = now()
     where clerk_user_id = me;
  exception
    when unique_violation then raise exception 'domain_taken' using errcode = '23505';
    when check_violation then raise exception 'invalid_domain' using errcode = '22023';
  end;
  return d;
end;
$$;
revoke all on function public.set_custom_domain(text) from public, anon;
grant execute on function public.set_custom_domain(text) to authenticated;

create or replace function public.resolve_custom_domain(p_host text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select business_slug from public.video_owner_profiles
   where custom_domain = lower(btrim(coalesce(p_host, '')))
     and custom_domain is not null
     and custom_domain_verified
$$;
revoke all on function public.resolve_custom_domain(text) from public;
grant execute on function public.resolve_custom_domain(text) to anon, authenticated;
