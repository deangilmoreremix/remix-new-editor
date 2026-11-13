-- Labels every database object that belongs to the "SmartVideo AI Timeline Editor" application, so it can be told apart in the shared
-- database (many applications use this Supabase project). Comments only plus one registry row: no schema or
-- behaviour change. Convention follows the existing table comments and public.app_migration_metadata.
-- Application tag used everywhere: smartvideo-timeline-editor

do $$ begin if to_regclass('public.timeline_projects') is not null then comment on table public.timeline_projects is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: saved timeline projects per user (Clerk sub).'; end if; end $$;
do $$ begin if to_regclass('public.published_videos') is not null then comment on table public.published_videos is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: published interactive videos (hosted player, /v and /watch links).'; end if; end $$;
do $$ begin if to_regclass('public.published_video_events') is not null then comment on table public.published_video_events is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: legacy per-view events for published videos (superseded by video_events).'; end if; end $$;
do $$ begin if to_regclass('public.video_leads') is not null then comment on table public.video_leads is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: leads captured by the hosted video lead form.'; end if; end $$;
do $$ begin if to_regclass('public.video_owner_profiles') is not null then comment on table public.video_owner_profiles is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: owner-claimed business namespace for readable video links.'; end if; end $$;
do $$ begin if to_regclass('public.video_slug_redirects') is not null then comment on table public.video_slug_redirects is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: old video/business slugs that redirect to the current link.'; end if; end $$;
do $$ begin if to_regclass('public.published_video_revisions') is not null then comment on table public.published_video_revisions is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: immutable snapshot per publication.'; end if; end $$;
do $$ begin if to_regclass('public.video_view_sessions') is not null then comment on table public.video_view_sessions is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: anonymous viewing sessions of published videos (no IP stored).'; end if; end $$;
do $$ begin if to_regclass('public.video_events') is not null then comment on table public.video_events is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: first-party player events (play, CTA, lead...); raw rows pruned after 90 days.'; end if; end $$;
do $$ begin if to_regclass('public.video_analytics_daily') is not null then comment on table public.video_analytics_daily is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: daily aggregates per published video.'; end if; end $$;
do $$ begin if to_regclass('public.video_daily_viewers') is not null then comment on table public.video_daily_viewers is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: hashed viewer ids per video/day for unique-viewer counts.'; end if; end $$;
do $$ begin if to_regclass('public.retarget_rules') is not null then comment on table public.retarget_rules is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: per-owner interest scoring weights.'; end if; end $$;
do $$ begin if to_regclass('public.retarget_preferences') is not null then comment on table public.retarget_preferences is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: per-owner notification preferences.'; end if; end $$;
do $$ begin if to_regclass('public.viewer_interests') is not null then comment on table public.viewer_interests is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: server-computed interest scores per anonymous session.'; end if; end $$;
do $$ begin if to_regclass('public.owner_notifications') is not null then comment on table public.owner_notifications is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: in-app alerts for the owner of a published video.'; end if; end $$;
do $$ begin if to_regclass('public.notification_email_queue') is not null then comment on table public.notification_email_queue is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor: email delivery queue (unused until an email provider is configured).'; end if; end $$;

do $$ begin if to_regprocedure('public._clip_label(jsonb, text)') is not null then comment on function public._clip_label(jsonb, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public._is_contact_label(text)') is not null then comment on function public._is_contact_label(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public._is_pricing_label(text)') is not null then comment on function public._is_pricing_label(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public._notify(text, text, text, text, text, text, text, jsonb, text, boolean)') is not null then comment on function public._notify(text, text, text, text, text, text, text, jsonb, text, boolean) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public._on_session_change()') is not null then comment on function public._on_session_change() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public._on_video_event()') is not null then comment on function public._on_video_event() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public._rule_weights(text)') is not null then comment on function public._rule_weights(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public._video_daily_bump(text, date, text, numeric)') is not null then comment on function public._video_daily_bump(text, date, text, numeric) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.build_daily_digests(boolean)') is not null then comment on function public.build_daily_digests(boolean) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.claim_business_slug(text, text)') is not null then comment on function public.claim_business_slug(text, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.delete_video_analytics(text)') is not null then comment on function public.delete_video_analytics(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.detect_interest_surges()') is not null then comment on function public.detect_interest_surges() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.get_published_video(text, text, text)') is not null then comment on function public.get_published_video(text, text, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.ingest_video_events(text, text, text, text, text, text, jsonb)') is not null then comment on function public.ingest_video_events(text, text, text, text, text, text, jsonb) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.mark_notifications_read(uuid[])') is not null then comment on function public.mark_notifications_read(uuid[]) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.owner_portfolio_summary(date, date)') is not null then comment on function public.owner_portfolio_summary(date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.owner_unread_notifications()') is not null then comment on function public.owner_unread_notifications() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.owner_video_stats(date, date)') is not null then comment on function public.owner_video_stats(date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.prune_video_analytics(integer)') is not null then comment on function public.prune_video_analytics(integer) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.published_videos_check_project()') is not null then comment on function public.published_videos_check_project() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.published_videos_guard()') is not null then comment on function public.published_videos_guard() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.published_videos_snapshot()') is not null then comment on function public.published_videos_snapshot() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.recompute_session_interests(uuid)') is not null then comment on function public.recompute_session_interests(uuid) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.record_video_event(text, text, text, text)') is not null then comment on function public.record_video_event(text, text, text, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.set_video_slug(text, text)') is not null then comment on function public.set_video_slug(text, text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.slug_is_valid(text)') is not null then comment on function public.slug_is_valid(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.strip_private_keys(jsonb)') is not null then comment on function public.strip_private_keys(jsonb) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.timeline_projects_guard()') is not null then comment on function public.timeline_projects_guard() is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.video_analytics_summary(text, date, date)') is not null then comment on function public.video_analytics_summary(text, date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.video_analytics_timeseries(text, date, date)') is not null then comment on function public.video_analytics_timeseries(text, date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.video_audience_segments(text, date, date)') is not null then comment on function public.video_audience_segments(text, date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.video_cta_performance(text, date, date)') is not null then comment on function public.video_cta_performance(text, date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.video_events_by_contact(text)') is not null then comment on function public.video_events_by_contact(text) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.video_interest_summary(text, date, date)') is not null then comment on function public.video_interest_summary(text, date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.video_retention_curve(text, date, date)') is not null then comment on function public.video_retention_curve(text, date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;
do $$ begin if to_regprocedure('public.video_section_engagement(text, jsonb, date, date)') is not null then comment on function public.video_section_engagement(text, jsonb, date, date) is '[smartvideo-timeline-editor] SmartVideo AI Timeline Editor'; end if; end $$;

-- Registry of which migrations belong to which application (exists in the shared database; absent locally).
do $$
begin
  if to_regclass('public.app_migration_metadata') is not null then
    insert into public.app_migration_metadata (version, app_name, description)
    select v.version, 'smartvideo-timeline-editor', v.description
      from (values
        ('20261112000000', 'Timeline projects table'),
        ('20261112010000', 'Publishing hardening, slugs, revisions'),
        ('20261112020000', 'First-party video analytics'),
        ('20261112030000', 'Retargeting and owner notifications'),
        ('20261112040000', 'Label SmartVideo Timeline Editor objects')) as v(version, description)
     where not exists (select 1 from public.app_migration_metadata m where m.version = v.version and m.app_name = 'smartvideo-timeline-editor');
  end if;
end $$;
