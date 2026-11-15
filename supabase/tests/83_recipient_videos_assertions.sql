-- Asserting checks for 20261118000000_recipient_videos.sql. Run with supabase/tests/run-recipient-videos-assertions.sh.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on
create schema if not exists t;
create or replace function t.ok(label text, cond boolean) returns void language plpgsql as $$
begin if cond is distinct from true then raise exception 'ASSERTION FAILED: %', label; end if; raise notice 'ok - %', label; end $$;
create or replace function t.fails_with(label text, code text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then
    if sqlstate = code then raise notice 'ok - % (%)', label, sqlstate; return; end if;
    raise exception 'ASSERTION FAILED (wrong error % <> %): % — %', sqlstate, code, label, sqlerrm;
  end;
  raise exception 'ASSERTION FAILED (statement succeeded): %', label;
end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;

insert into public.published_videos (id, clerk_user_id, title, project, published, revision) values
  ('vidAAAAAAAA', 'userA', 'A', '{"timelineSeconds":30}', true, 1), ('vidBBBBBBBB', 'userB', 'B', '{"timelineSeconds":30}', true, 1);
select set_config('t.h1', encode(sha256('tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1'::bytea), 'hex'), false);
select set_config('t.h2', encode(sha256('tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2'::bytea), 'hex'), false);
select set_config('t.l1', (select id::text from recipient_links_issue('userA', 'vidAAAAAAAA', array['Acme'], array[current_setting('t.h1')], null)), false);
select set_config('t.l2', (select id::text from recipient_links_issue('userA', 'vidAAAAAAAA', array['Bright'], array[current_setting('t.h2')], null)), false);
select set_config('t.p1', 'vidAAAAAAAA/' || current_setting('t.l1') || '/' || repeat('a', 32) || '.mp4', false);

select t.ok('the bucket is private with the size and type limits (when storage exists)', not exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') or (select not public and file_size_limit = 209715200 and allowed_mime_types = array['video/mp4', 'video/webm'] from storage.buckets where id = 'recipient-videos'));
select t.ok('prepare is true for the owner''s live link, false for another owner, another video, a made-up link', recipient_video_prepare('userA', 'vidAAAAAAAA', current_setting('t.l1')::uuid) and not recipient_video_prepare('userB', 'vidAAAAAAAA', current_setting('t.l1')::uuid) and not recipient_video_prepare('userA', 'vidBBBBBBBB', current_setting('t.l1')::uuid) and not recipient_video_prepare('userA', 'vidAAAAAAAA', gen_random_uuid()));
select t.fails_with('an owner id is required', '28000', $$select recipient_video_prepare(null, 'vidAAAAAAAA', gen_random_uuid())$$);
select t.fails_with('registering for someone else''s link is refused (looks like "not found")', 'P0002', format($f$select recipient_video_register('userB', 'vidAAAAAAAA', %L, %L, 'video/mp4', 1000)$f$, current_setting('t.l1'), current_setting('t.p1')));
select t.fails_with('a path that belongs to another link is refused', '22023', format($f$select recipient_video_register('userA', 'vidAAAAAAAA', %L, %L, 'video/mp4', 1000)$f$, current_setting('t.l1'), 'vidAAAAAAAA/' || current_setting('t.l2') || '/' || repeat('a', 32) || '.mp4'));
select t.fails_with('a path outside the scheme is refused', '23514', format($f$select recipient_video_register('userA', 'vidAAAAAAAA', %L, %L, 'video/mp4', 1000)$f$, current_setting('t.l1'), 'vidAAAAAAAA/' || current_setting('t.l1') || '/../../secret.mp4'));
select t.fails_with('only mp4/webm', '23514', format($f$select recipient_video_register('userA', 'vidAAAAAAAA', %L, %L, 'video/x-flv', 1000)$f$, current_setting('t.l1'), current_setting('t.p1')));
select t.fails_with('size limits (0 bytes, over 200 MB)', '23514', format($f$select recipient_video_register('userA', 'vidAAAAAAAA', %L, %L, 'video/mp4', 209715201)$f$, current_setting('t.l1'), current_setting('t.p1')));
select t.ok('registering the first video returns no old path', recipient_video_register('userA', 'vidAAAAAAAA', current_setting('t.l1')::uuid, current_setting('t.p1'), 'video/mp4', 5000) is null);
select set_config('t.p1b', 'vidAAAAAAAA/' || current_setting('t.l1') || '/' || repeat('b', 32) || '.mp4', false);
select t.ok('replacing it returns the OLD path (so the server can delete the object) and keeps one record per link', recipient_video_register('userA', 'vidAAAAAAAA', current_setting('t.l1')::uuid, current_setting('t.p1b'), 'video/mp4', 6000) = current_setting('t.p1') and (select count(*) from recipient_videos) = 1);
select t.ok('re-registering the same path is not reported as an old object', recipient_video_register('userA', 'vidAAAAAAAA', current_setting('t.l1')::uuid, current_setting('t.p1b'), 'video/mp4', 6000) is null);

select t.ok('resolve: the right token gets the object', (recipient_video_resolve('vidAAAAAAAA', current_setting('t.h1')) ->> 'object_path') = current_setting('t.p1b'));
select t.ok('resolve: another recipient, a made-up token, a malformed token and the same token on another video get nothing', recipient_video_resolve('vidAAAAAAAA', current_setting('t.h2')) is null and recipient_video_resolve('vidAAAAAAAA', repeat('f', 64)) is null and recipient_video_resolve('vidAAAAAAAA', 'plain-token') is null and recipient_video_resolve('vidBBBBBBBB', current_setting('t.h1')) is null);
select t.ok('list shows the owner''s videos and nobody else''s', (select count(*) from recipient_videos_list('userA', 'vidAAAAAAAA')) = 1 and (select count(*) from recipient_videos_list('userB', 'vidAAAAAAAA')) = 0);
select recipient_links_revoke(current_setting('t.l1')::uuid, 'userA');
select t.ok('after the link is revoked its video is no longer served, and no new upload is prepared', recipient_video_resolve('vidAAAAAAAA', current_setting('t.h1')) is null and not recipient_video_prepare('userA', 'vidAAAAAAAA', current_setting('t.l1')::uuid));
select t.ok('remove is owner-only and returns the path to delete; a second call returns null', recipient_video_remove('userB', current_setting('t.l1')::uuid) is null and recipient_video_remove('userA', current_setting('t.l1')::uuid) = current_setting('t.p1b') and recipient_video_remove('userA', current_setting('t.l1')::uuid) is null);
select t.ok('expired links stop serving too', (select recipient_video_register('userA', 'vidAAAAAAAA', current_setting('t.l2')::uuid, 'vidAAAAAAAA/' || current_setting('t.l2') || '/' || repeat('c', 32) || '.mp4', 'video/mp4', 10) is null));
update recipient_links set expires_at = now() - interval '1 minute', created_at = now() - interval '2 minutes' where id = current_setting('t.l2')::uuid;
select t.ok('...an expired link gets nothing', recipient_video_resolve('vidAAAAAAAA', current_setting('t.h2')) is null);
delete from recipient_links where id = current_setting('t.l2')::uuid;
select t.ok('...cascade removed the record', (select count(*) from recipient_videos) = 0);
select t.ok('anon and authenticated cannot run any of the functions or read the table', not (has_function_privilege('anon', 'public.recipient_video_resolve(text,text)', 'execute') or has_function_privilege('authenticated', 'public.recipient_video_resolve(text,text)', 'execute') or has_function_privilege('authenticated', 'public.recipient_video_register(text,text,uuid,text,text,bigint)', 'execute') or has_function_privilege('authenticated', 'public.recipient_video_prepare(text,text,uuid)', 'execute') or has_table_privilege('anon', 'public.recipient_videos', 'select') or has_table_privilege('authenticated', 'public.recipient_videos', 'select')) and has_function_privilege('service_role', 'public.recipient_video_resolve(text,text)', 'execute'));
-- Retention (20261119000000): 90 days
select recipient_links_issue('userA', 'vidAAAAAAAA', array['Old', 'Fresh'], array[encode(sha256('tokenOLD'::bytea), 'hex'), encode(sha256('tokenFRESH'::bytea), 'hex')], null);
select set_config('t.lo', (select id::text from recipient_links where label = 'Old'), false);
select set_config('t.lf', (select id::text from recipient_links where label = 'Fresh'), false);
select recipient_video_register('userA', 'vidAAAAAAAA', current_setting('t.lo')::uuid, 'vidAAAAAAAA/' || current_setting('t.lo') || '/' || repeat('d', 32) || '.mp4', 'video/mp4', 10);
select recipient_video_register('userA', 'vidAAAAAAAA', current_setting('t.lf')::uuid, 'vidAAAAAAAA/' || current_setting('t.lf') || '/' || repeat('e', 32) || '.mp4', 'video/mp4', 10);
select t.ok('both are served while young', recipient_video_resolve('vidAAAAAAAA', encode(sha256('tokenOLD'::bytea), 'hex')) is not null and recipient_video_resolve('vidAAAAAAAA', encode(sha256('tokenFRESH'::bytea), 'hex')) is not null);
update recipient_videos set created_at = now() - interval '91 days' where recipient_link_id = current_setting('t.lo')::uuid;
update recipient_videos set created_at = now() - interval '45 days' where recipient_link_id = current_setting('t.lf')::uuid;
select t.ok('a video older than 90 days is no longer served (before any purge), a fresh one still is', recipient_video_resolve('vidAAAAAAAA', encode(sha256('tokenOLD'::bytea), 'hex')) is null and recipient_video_resolve('vidAAAAAAAA', encode(sha256('tokenFRESH'::bytea), 'hex')) is not null);
select t.fails_with('purge limit is bounded', '22023', $$select * from recipient_videos_purge_expired(0)$$);
select set_config('t.purged', (select string_agg(object_path, ',') from recipient_videos_purge_expired(200)), false);
select t.ok('purge returns exactly the expired row''s object path', current_setting('t.purged') like '%' || repeat('d', 32) || '.mp4' and current_setting('t.purged') not like '%,%');
select t.ok('...and the 45-day-old row is left (retention is 90 days, not 30)', (select count(*) from recipient_videos) = 1 and recipient_video_resolve('vidAAAAAAAA', encode(sha256('tokenFRESH'::bytea), 'hex')) is not null);
select t.ok('a second purge finds nothing', (select count(*) from recipient_videos_purge_expired(200)) = 0);
select t.ok('anon/authenticated cannot purge', not (has_function_privilege('anon', 'public.recipient_videos_purge_expired(integer)', 'execute') or has_function_privilege('authenticated', 'public.recipient_videos_purge_expired(integer)', 'execute')) and has_function_privilege('service_role', 'public.recipient_videos_purge_expired(integer)', 'execute'));
do $$ begin raise notice 'ALL ASSERTIONS PASSED'; end $$;
