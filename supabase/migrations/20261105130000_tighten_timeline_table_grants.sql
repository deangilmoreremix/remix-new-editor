-- ===========================================================================
-- tighten_timeline_table_grants.sql
--
-- Projects whose default privileges grant every table privilege to the API
-- roles would also give anon/authenticated TRUNCATE (which bypasses RLS),
-- REFERENCES and TRIGGER on the timeline tables. Keep only the privileges
-- the RLS policies in 20261104120000_create_video_leads.sql and
-- 20261105120000_create_published_videos.sql are written for.
-- ===========================================================================
revoke truncate, references, trigger, update on public.video_leads from anon, authenticated;
revoke truncate, references, trigger on public.published_videos from anon, authenticated;
