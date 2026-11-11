# Rollout and rollback: Projects, publishing, analytics, notifications

Nothing here has been applied to a hosted Supabase project or deployed. Do it in this order, on a Supabase dev branch first.

## 1. Database (Supabase dev branch, then production)
Apply in order (all additive/idempotent): `20260730_create_distributed_rate_limiter` (only if absent), `20261105120000_create_published_videos`, `20261105160000_published_video_events`, `20261112000000_create_timeline_projects`, `20261112010000_publish_hardening_slugs`, `20261112020000_video_analytics`, `20261112030000_retargeting_notifications`.
Before production: compare the live `published_videos` / `projects` schema with the migrations (drift), then run the security and performance advisors and `supabase/tests/run-assertions.sh` on the branch.
Behaviour change to announce: anonymous table reads of `published_videos` stop (the public page now uses `get_published_video`); the old `/watch/<id>` links keep working.

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
Application: redeploy the previous Netlify build. Database: new tables/RPCs can stay (unused). Compensating statements if the public read change must be reverted: recreate policy "Anyone reads published videos" on `published_videos` (`for select using (published)`), and `grant execute` on the previous `record_video_event` / `increment_video_view` signatures. Analytics data removal: `delete_video_analytics(video_id)` per video, or `truncate video_events, video_view_sessions, video_analytics_daily, video_daily_viewers cascade`.
