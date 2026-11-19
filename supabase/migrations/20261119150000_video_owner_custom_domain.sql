-- ===========================================================================
-- video_owner_custom_domain.sql
--
-- A business can serve its videos from its own domain: videos.acme.com/intro
-- shows /v/<business>/intro. The domain itself must still be added to the
-- hosting site (Netlify domain alias + DNS) by an administrator, which is what
-- actually gates traffic; this only records which business a hostname belongs to.
--
--   video_owner_profiles.custom_domain   lower-case hostname, unique, optional
--   set_custom_domain(p_domain)          owner sets / clears (null) their domain
--   resolve_custom_domain(p_host)        public: the business slug for a host
-- ===========================================================================

alter table public.video_owner_profiles
  add column if not exists custom_domain text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'video_owner_profiles_custom_domain_check') then
    alter table public.video_owner_profiles
      add constraint video_owner_profiles_custom_domain_check
      check (custom_domain is null or (
        char_length(custom_domain) <= 253
        and custom_domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$'
        and custom_domain !~ '(^|\.)(smartvid\.app|netlify\.app|netlify\.com|localhost)$'
      ));
  end if;
end $$;

create unique index if not exists video_owner_profiles_custom_domain_key
  on public.video_owner_profiles (custom_domain) where custom_domain is not null;

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
    update public.video_owner_profiles set custom_domain = d, updated_at = now() where clerk_user_id = me;
  exception
    when unique_violation then raise exception 'domain_taken' using errcode = '23505';
    when check_violation then raise exception 'invalid_domain' using errcode = '22023';
  end;
  return d;
end;
$$;
revoke all on function public.set_custom_domain(text) from public, anon;
grant execute on function public.set_custom_domain(text) to authenticated;

-- Public: only the business slug, nothing about the owner.
create or replace function public.resolve_custom_domain(p_host text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select business_slug from public.video_owner_profiles
   where custom_domain = lower(btrim(coalesce(p_host, ''))) and custom_domain is not null
$$;
revoke all on function public.resolve_custom_domain(text) from public;
grant execute on function public.resolve_custom_domain(text) to anon, authenticated;
