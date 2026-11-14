-- Per-recipient rendered videos in a PRIVATE bucket (follow-up to Stage 10).
--
-- A recipient's personalized MP4 is stored in the private storage bucket `recipient-videos` (no public read, no policies for anon or
-- authenticated: only the service role, through signed URLs the server mints, can read or write objects). This table records which object
-- belongs to which personal link. Access follows the link: a revoked or expired link, or a token for another video, gets nothing.
--
-- Object path is made by the SERVER: <video_id>/<link_id>/<random>.<ext>. Nothing here trusts a client-supplied path.
-- NOT applied to production by this change.

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('recipient-videos', 'recipient-videos', false, 209715200, array['video/mp4', 'video/webm'])
    on conflict (id) do update set public = false, file_size_limit = 209715200, allowed_mime_types = array['video/mp4', 'video/webm'];
  end if;
end $$;

create table if not exists public.recipient_videos (
  recipient_link_id uuid primary key references public.recipient_links (id) on delete cascade,
  clerk_user_id     text not null,
  video_id          text not null references public.published_videos (id) on delete cascade,
  object_path       text not null,
  content_type      text not null,
  bytes             bigint not null,
  created_at        timestamptz not null default now(),
  constraint recipient_videos_path_check check (object_path ~ '^[A-Za-z0-9_-]{8,32}/[0-9a-f-]{36}/[0-9a-f]{32}\.(mp4|webm)$'),
  constraint recipient_videos_type_check check (content_type in ('video/mp4', 'video/webm')),
  constraint recipient_videos_bytes_check check (bytes between 1 and 209715200)
);
create unique index if not exists recipient_videos_path_uidx on public.recipient_videos (object_path);
create index if not exists recipient_videos_owner_idx on public.recipient_videos (clerk_user_id, video_id);

alter table public.recipient_videos enable row level security;
drop policy if exists "recipient_videos_select_own" on public.recipient_videos;
create policy "recipient_videos_select_own" on public.recipient_videos for select to authenticated
  using (clerk_user_id = nullif(coalesce(auth.jwt() ->> 'sub', current_setting('app.clerk_user_id', true)), ''));
revoke all on table public.recipient_videos from anon, authenticated;

-- Is this link the caller's, for this video, and still live? (Called before a signed upload URL is minted.) false for "not yours" and "missing" alike.
create or replace function public.recipient_video_prepare(p_owner text, p_video_id text, p_link_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if p_owner is null or p_owner = '' then raise exception 'recipient_video_prepare: owner is required' using errcode = '28000'; end if;
  return exists (select 1 from public.recipient_links l where l.id = p_link_id and l.video_id = p_video_id and l.clerk_user_id = p_owner and l.revoked_at is null);
end;
$$;

-- Records the uploaded object for a link (replacing an earlier one). Returns the OLD object path (so the server can delete it) or null.
create or replace function public.recipient_video_register(p_owner text, p_video_id text, p_link_id uuid, p_path text, p_type text, p_bytes bigint)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare old_path text;
begin
  if p_owner is null or p_owner = '' then raise exception 'recipient_video_register: owner is required' using errcode = '28000'; end if;
  if not exists (select 1 from public.recipient_links l where l.id = p_link_id and l.video_id = p_video_id and l.clerk_user_id = p_owner and l.revoked_at is null) then
    raise exception 'recipient_video_register: link not found' using errcode = 'P0002';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> p_video_id or split_part(p_path, '/', 2) <> p_link_id::text then
    raise exception 'recipient_video_register: the object path does not belong to this link' using errcode = '22023';
  end if;
  select object_path into old_path from public.recipient_videos where recipient_link_id = p_link_id;
  insert into public.recipient_videos (recipient_link_id, clerk_user_id, video_id, object_path, content_type, bytes)
  values (p_link_id, p_owner, p_video_id, p_path, p_type, p_bytes)
  on conflict (recipient_link_id) do update set object_path = excluded.object_path, content_type = excluded.content_type, bytes = excluded.bytes, created_at = now();
  return case when old_path = p_path then null else old_path end;
end;
$$;

-- The PUBLIC path (the recipient-video function, service role): the object for a token, only while that link is live, for THIS video.
create or replace function public.recipient_video_resolve(p_video_id text, p_token_hash text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object('object_path', v.object_path, 'content_type', v.content_type, 'bytes', v.bytes, 'link_expires_at', l.expires_at)
    from public.recipient_links l join public.recipient_videos v on v.recipient_link_id = l.id
   where l.video_id = p_video_id and p_token_hash ~ '^[a-f0-9]{64}$' and l.token_hash = p_token_hash
     and l.revoked_at is null and (l.expires_at is null or l.expires_at > now())
   limit 1;
$$;

create or replace function public.recipient_videos_list(p_owner text, p_video_id text)
returns table (recipient_link_id uuid, bytes bigint, content_type text, created_at timestamptz)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_owner is null or p_owner = '' then raise exception 'recipient_videos_list: owner is required' using errcode = '28000'; end if;
  return query select v.recipient_link_id, v.bytes, v.content_type, v.created_at from public.recipient_videos v where v.clerk_user_id = p_owner and v.video_id = p_video_id order by v.created_at desc limit 5000;
end;
$$;

-- Removes the record and returns the object path to delete; null for "none" and "not yours" alike.
create or replace function public.recipient_video_remove(p_owner text, p_link_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare old_path text;
begin
  if p_owner is null or p_owner = '' then raise exception 'recipient_video_remove: owner is required' using errcode = '28000'; end if;
  delete from public.recipient_videos where recipient_link_id = p_link_id and clerk_user_id = p_owner returning object_path into old_path;
  return old_path;
end;
$$;

revoke all on function public.recipient_video_prepare(text, text, uuid) from public, anon, authenticated;
revoke all on function public.recipient_video_register(text, text, uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.recipient_video_resolve(text, text) from public, anon, authenticated;
revoke all on function public.recipient_videos_list(text, text) from public, anon, authenticated;
revoke all on function public.recipient_video_remove(text, uuid) from public, anon, authenticated;
grant execute on function public.recipient_video_prepare(text, text, uuid) to service_role;
grant execute on function public.recipient_video_register(text, text, uuid, text, text, bigint) to service_role;
grant execute on function public.recipient_video_resolve(text, text) to service_role;
grant execute on function public.recipient_videos_list(text, text) to service_role;
grant execute on function public.recipient_video_remove(text, uuid) to service_role;
