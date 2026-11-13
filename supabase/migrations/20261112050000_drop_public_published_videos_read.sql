-- [smartvideo-timeline-editor] SmartVideo AI Timeline Editor
-- Closes public enumeration of published_videos (and the webhook/email data inside `project`). Apply ONLY after the
-- app version that reads through public.get_published_video() is deployed; the older version read the table directly.
-- Rollback: create policy "Anyone reads published videos" on public.published_videos for select using (published = true);
drop policy if exists "Anyone reads published videos" on public.published_videos;

-- The old unauthenticated writers are replaced by the validated, rate-limited server path (/api/video-events).
revoke execute on function public.record_video_event(text, text, text, text) from anon, authenticated;
revoke execute on function public.increment_video_view(text) from anon, authenticated;

do $$
begin
  if to_regclass('public.app_migration_metadata') is not null then
    insert into public.app_migration_metadata (version, app_name, description)
    select '20261112050000', 'smartvideo-timeline-editor', 'Drop public read of published_videos (use get_published_video)'
     where not exists (select 1 from public.app_migration_metadata where version = '20261112050000' and app_name = 'smartvideo-timeline-editor');
  end if;
end $$;
