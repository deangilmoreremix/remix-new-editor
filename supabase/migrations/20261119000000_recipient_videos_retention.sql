-- Retention for private per-recipient videos: 90 days after the upload (re-uploading starts a new 90 days).
--
-- 1. recipient_video_resolve stops serving a video older than 90 days even before the purge has run.
-- 2. recipient_videos_purge_expired deletes the expired rows (FOR UPDATE SKIP LOCKED, bounded batch) and returns their object paths,
--    so the server (the scheduled function recipient-video-purge) can delete the stored files. service_role only.
-- If a file cannot be deleted after its row is gone, the file is orphaned (private, unreachable: nothing can sign it any more) and is
-- reported by the function; it is not retried.

create or replace function public.recipient_video_resolve(p_video_id text, p_token_hash text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('object_path', v.object_path, 'content_type', v.content_type, 'bytes', v.bytes, 'link_expires_at', l.expires_at)
    from public.recipient_links l join public.recipient_videos v on v.recipient_link_id = l.id
   where l.video_id = p_video_id and p_token_hash ~ '^[a-f0-9]{64}$' and l.token_hash = p_token_hash
     and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())
     and v.created_at > now() - interval '90 days'
   limit 1;
$$;

create or replace function public.recipient_videos_purge_expired(p_limit integer default 200)
returns table (object_path text)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then raise exception 'recipient_videos_purge_expired: limit must be 1-1000' using errcode = '22023'; end if;
  return query
    with doomed as (
      select v.recipient_link_id from public.recipient_videos v
       where v.created_at <= now() - interval '90 days'
       order by v.created_at limit p_limit for update skip locked
    )
    delete from public.recipient_videos d using doomed where d.recipient_link_id = doomed.recipient_link_id returning d.object_path;
end;
$$;

revoke all on function public.recipient_videos_purge_expired(integer) from public, anon, authenticated;
grant execute on function public.recipient_videos_purge_expired(integer) to service_role;
