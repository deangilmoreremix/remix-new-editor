-- ===========================================================================
-- video_leads_call_attempts.sql
--
-- Click-to-call (upstream "Email to notify about call attempt"): when a
-- viewer of a published video taps a phone call-to-action, lead-capture
-- records a 'call-attempt' row for the video's owner.
-- ===========================================================================
alter table public.video_leads drop constraint if exists video_leads_kind_check;
alter table public.video_leads add constraint video_leads_kind_check
  check (kind in ('lead-form', 'list-builder', 'personalizer', 'call-attempt'));
