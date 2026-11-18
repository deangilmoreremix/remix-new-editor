-- ===========================================================================
-- guest_limits.sql
--
-- Guests: visitors who publish and create personal links WITHOUT an account.
-- A guest signs requests with a token minted by netlify/functions/guest-token.js:
--   sub = 'guest_<22 random chars>', role = authenticated.
-- Every existing owner policy keys on `auth.jwt() ->> 'sub'`, so a guest already
-- owns exactly their own rows. This migration adds what a free, anonymous owner
-- must NOT be able to do, and cleans their content up:
--
--   * quotas       10 published videos and 200 personal links per guest
--   * unlisted     a guest's videos are always 'unlisted' (never search-indexed)
--   * no vanity    no readable /v/<business>/<slug> address, no business namespace
--   * no projects  no cloud timeline projects (a guest's project stays in the browser)
--   * expiry       prune_guest_content(30): guest videos (and with them their links,
--                  analytics) and leads go 30 days after last use
--   * claiming     claim_guest_content(guest, user): re-own a guest's content to an
--                  account after they sign in (service role only; called by
--                  netlify/functions/guest-claim.js after it verifies BOTH identities)
--
-- Guests are identified purely by the `guest_` prefix of the owner id, which only
-- guest-token.js can mint (Clerk ids never start with it).
-- ===========================================================================

create or replace function public.is_guest_owner(p_owner text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$ select coalesce(p_owner, '') like 'guest\_%' $$;
revoke all on function public.is_guest_owner(text) from public;
grant execute on function public.is_guest_owner(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------- quotas
-- security definer so the count sees every row the guest owns whatever the row policies allow.
create or replace function public.guest_quota_videos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_guest_owner(new.clerk_user_id)
     -- re-publishing an existing video is an upsert: it fires this trigger but adds nothing
     and not exists (select 1 from public.published_videos v where v.id = new.id)
     and (select count(*) from public.published_videos v where v.clerk_user_id = new.clerk_user_id) >= 10 then
    raise exception 'guest_limit_videos' using hint = 'Guests can publish up to 10 videos. Sign in to publish more.';
  end if;
  return new;
end;
$$;
revoke all on function public.guest_quota_videos() from public, anon, authenticated;

create or replace function public.guest_quota_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_guest_owner(new.clerk_user_id)
     and not exists (select 1 from public.video_personalizations p where p.id = new.id)
     and (select count(*) from public.video_personalizations p where p.clerk_user_id = new.clerk_user_id) >= 200 then
    raise exception 'guest_limit_links' using hint = 'Guests can have up to 200 personal links. Sign in to create more.';
  end if;
  return new;
end;
$$;
revoke all on function public.guest_quota_links() from public, anon, authenticated;

drop trigger if exists guest_quota_videos on public.published_videos;
create trigger guest_quota_videos
  before insert on public.published_videos
  for each row execute function public.guest_quota_videos();

drop trigger if exists guest_quota_links on public.video_personalizations;
create trigger guest_quota_links
  before insert on public.video_personalizations
  for each row execute function public.guest_quota_links();

-- ---------------------------------------------------------------- unlisted, no vanity addresses
create or replace function public.guest_video_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_guest_owner(new.clerk_user_id) then
    new.privacy := 'unlisted';
    if new.slug is not null then
      raise exception 'guest_not_allowed_slug' using hint = 'Guests get a /watch link. Readable addresses need an account.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guest_video_rules() from public, anon, authenticated;

drop trigger if exists guest_video_rules on public.published_videos;
create trigger guest_video_rules
  before insert or update on public.published_videos
  for each row execute function public.guest_video_rules();

create or replace function public.guest_no_business()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_guest_owner(new.clerk_user_id) then
    raise exception 'guest_not_allowed_business' using hint = 'Business names for readable links need an account.';
  end if;
  return new;
end;
$$;
revoke all on function public.guest_no_business() from public, anon, authenticated;

drop trigger if exists guest_no_business on public.video_owner_profiles;
create trigger guest_no_business
  before insert or update on public.video_owner_profiles
  for each row execute function public.guest_no_business();

create or replace function public.guest_no_projects()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_guest_owner(new.clerk_user_id) then
    raise exception 'guest_not_allowed_projects' using hint = 'Cloud projects need an account.';
  end if;
  return new;
end;
$$;
revoke all on function public.guest_no_projects() from public, anon, authenticated;

drop trigger if exists guest_no_projects on public.timeline_projects;
create trigger guest_no_projects
  before insert on public.timeline_projects
  for each row execute function public.guest_no_projects();

-- ---------------------------------------------------------------- expiry
-- A guest video is unused when it has not been edited AND nobody has opened, played or
-- clicked it (latest video_events) for p_days. Deleting it cascades to its personal
-- links, analytics and notifications. Leads have no foreign key, so they go by age.
create or replace function public.prune_guest_content(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - make_interval(days => greatest(p_days, 1));
  v integer;
  l integer;
begin
  delete from public.video_leads d
   where public.is_guest_owner(d.clerk_user_id) and d.created_at < cutoff;
  get diagnostics l = row_count;

  delete from public.published_videos v
   where public.is_guest_owner(v.clerk_user_id)
     and v.updated_at < cutoff
     and not exists (select 1 from public.video_events e where e.video_id = v.id and e.created_at >= cutoff)
     and not exists (select 1 from public.video_personalizations p where p.video_id = v.id and p.updated_at >= cutoff);
  get diagnostics v = row_count;

  return jsonb_build_object('videos', v, 'leads', l, 'cutoff', cutoff);
end;
$$;
revoke all on function public.prune_guest_content(integer) from public, anon, authenticated;
grant execute on function public.prune_guest_content(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('smartvideo-prune-guest-content', '43 3 * * *', 'select public.prune_guest_content(30)');
  end if;
end $$;

-- ---------------------------------------------------------------- claiming
-- Called ONLY by netlify/functions/guest-claim.js, after it has verified the guest credential
-- and the Clerk session, so the two ids are known to belong to the same person.
create or replace function public.claim_guest_content(p_guest text, p_user text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v integer;
  l integer;
  ld integer;
begin
  if not public.is_guest_owner(p_guest) or coalesce(p_user, '') = '' or public.is_guest_owner(p_user) then
    raise exception 'invalid_claim';
  end if;
  update public.published_videos set clerk_user_id = p_user where clerk_user_id = p_guest;
  get diagnostics v = row_count;
  update public.video_personalizations set clerk_user_id = p_user where clerk_user_id = p_guest;
  get diagnostics l = row_count;
  update public.video_leads set clerk_user_id = p_user where clerk_user_id = p_guest;
  get diagnostics ld = row_count;
  return jsonb_build_object('videos', v, 'links', l, 'leads', ld);
end;
$$;
revoke all on function public.claim_guest_content(text, text) from public, anon, authenticated;
grant execute on function public.claim_guest_content(text, text) to service_role;

comment on function public.is_guest_owner(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.prune_guest_content(integer) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: removes guest videos/leads unused for p_days';
comment on function public.claim_guest_content(text, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: re-owns a guest''s content to an account (service role only)';
comment on function public.guest_quota_videos() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.guest_quota_links() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.guest_video_rules() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.guest_no_business() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
comment on function public.guest_no_projects() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor';
