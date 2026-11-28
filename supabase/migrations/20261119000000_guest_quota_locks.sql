-- ===========================================================================
-- guest_quota_locks.sql
--
-- Review follow-up for 20261115120000_guest_limits.sql.
--
-- 1. The 10-video and 200-link caps counted rows and then let the insert through. Two requests from
--    the same guest running at the same moment could both see "9" and both insert, ending at 11
--    (or 201). Each trigger now takes a transaction-scoped advisory lock for that owner first, so a
--    second request waits for the first to commit and then counts correctly. The lock is keyed by
--    owner and kind, so different guests (and videos vs links) never wait on each other.
--
-- 2. `unique (video_id, contact_id)` lets a video have any number of links with no contact, because
--    NULLs never collide. The editor always sends a contact, so this closes a hole nothing uses:
--    at most one contact-less link per video.
--
-- Not changed (reviewed, by design): get_personalization() is security definer and readable by
-- anon on purpose (it is how a viewer opens a link; the table itself is owner-only); an
-- index on video_personalizations(video_id) already exists as the leading column of the
-- (video_id, contact_id) unique constraint.
-- ===========================================================================

create or replace function public.guest_quota_videos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_guest_owner(new.clerk_user_id) then
    -- Serialise this guest's inserts; the count below then sees every committed row.
    perform pg_advisory_xact_lock(hashtextextended('guest_quota_videos:' || new.clerk_user_id, 0));
    if not exists (select 1 from public.published_videos v where v.id = new.id)
       and (select count(*) from public.published_videos v where v.clerk_user_id = new.clerk_user_id) >= 10 then
      raise exception 'guest_limit_videos' using hint = 'Guests can publish up to 10 videos. Sign in to publish more.';
    end if;
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
  if public.is_guest_owner(new.clerk_user_id) then
    perform pg_advisory_xact_lock(hashtextextended('guest_quota_links:' || new.clerk_user_id, 0));
    if not exists (select 1 from public.video_personalizations p where p.id = new.id)
       and (select count(*) from public.video_personalizations p where p.clerk_user_id = new.clerk_user_id) >= 200 then
      raise exception 'guest_limit_links' using hint = 'Guests can have up to 200 personal links. Sign in to create more.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guest_quota_links() from public, anon, authenticated;

create unique index if not exists video_personalizations_one_contactless
  on public.video_personalizations (video_id)
  where contact_id is null;
