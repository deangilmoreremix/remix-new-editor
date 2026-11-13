# Rollout and rollback: Projects, publishing, analytics, notifications

Nothing here has been applied to a hosted Supabase project or deployed. Do it in this order, on a Supabase dev branch first.

## 1. Database (Supabase dev branch, then production)
This is a SHARED Supabase project (many applications). Everything here is labelled `smartvideo-timeline-editor`: table/function comments start with `[smartvideo-timeline-editor]`, and migrations are registered in `public.app_migration_metadata` under that `app_name`. Shared objects (`rate_limits`, `rate_limit_check`, `rate_limit_cleanup`) are NOT modified; they are currently executable by anon/authenticated, which is worth tightening as a separate cross-application change.
Apply in order (additive/idempotent), using migration names prefixed `smartvideo_`: `20261112000000_create_timeline_projects`, `20261112010000_publish_hardening_slugs`, `20261112020000_video_analytics`, `20261112030000_retargeting_notifications`, `20261112040000_label_smartvideo_timeline_objects`. (`20261105120000`/`20261105160000` and the rate limiter are already live under other version names; skip them.)
**After** the new app version is deployed and verified, apply `20261112050000_drop_public_published_videos_read` (removes anonymous table reads; the previous app version needed them, so it is deliberately last).
Before production: compare the live `published_videos` / `projects` schema with the migrations (drift), then run the security and performance advisors and `supabase/tests/run-assertions.sh` on the branch.
Behaviour change (only after step 050000): anonymous table reads of `published_videos` stop (the public page uses `get_published_video`); `/watch/<id>` links keep working.

## 2. Netlify
- Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only, never `VITE_`), optional `ANALYTICS_HASH_SALT`.
- Confirm in a deploy preview: `/api/video-events` redirect, scheduled function `digest-daily`, `/v/*` edge function.
- Pruning: pg_cron if installed, otherwise the scheduled function calls `prune_video_analytics`.

## 3. Edge function
Deploy `supabase/functions/lead-capture` (new `logic.ts`) and set `LEAD_CAPTURE_ALLOWED_ORIGINS`.

## 4. Smoke test (deploy preview, real account)
Publish a project, open the readable link on a phone, play/click/submit, check the Analytics tab and the header bell, then production.

## Email
No provider is configured by design. Notifications are in-app; the UI says email delivery requires configuration.

## Rollback
Application: redeploy the previous Netlify build. Database: new tables/RPCs can stay (unused). Compensating statements if the public read change must be reverted: recreate policy "Anyone reads published videos" (only needed if 050000 was applied) on `published_videos` (`for select using (published)`), and `grant execute` on the previous `record_video_event` / `increment_video_view` signatures. Analytics data removal: `delete_video_analytics(video_id)` per video, or `truncate video_events, video_view_sessions, video_analytics_daily, video_daily_viewers cascade`.
