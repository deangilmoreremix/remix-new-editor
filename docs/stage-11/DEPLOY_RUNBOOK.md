# Deploy runbook: heatmap analytics, campaign filter, campaign attribution

Read-only inspection of the live project (bzxohkrxcwodllketcpz) on 2026-11-17 found: `published_videos`, `video_view_sessions`, `video_events`, `video_analytics_daily`, `ingest_video_events(7 args)` and `pgcrypto` exist. NONE of the heatmap RPCs exist, and neither `video_campaigns` nor `campaign_recipients` exist. So the Stage 7 migration has not been applied live. Nothing was written to the live project. The live project also has migrations that are not in this repo (for example `video_retention_curves`, `smartcrm_lead_automation_*`); a Supabase test branch cannot replay history (every existing branch is MIGRATIONS_FAILED), so validate on a staging copy or with the dry-run below.

## Order (all together, then reload the schema cache)
1. `20261114100000_heatmap_analytics.sql` (Stage 7: capture columns, heatmap RPCs, min-cohort suppression)
2. `20261117100000_heatmap_campaign_filter.sql` (drops the old heatmap RPC signatures and recreates them with a trailing `p_campaign uuid default null`; adds `video_heat_campaign_options`)
3. `20261117200000_video_session_campaign_attribution.sql` (adds nullable `video_view_sessions.campaign_id`, writer RPC `attribute_video_session_campaign`, service_role only)
4. Campaign tables come from branch `claude/modest-tesla-yhjel6` (`20261113000000_video_campaigns.sql`). Either order with 3 is safe: without them attribution is a silent no-op; the foreign key is created only if `video_campaigns` exists when 3 runs.
5. Deploy the app and `netlify/functions/video-events.js` in the same release (the old RPC signatures are gone after step 2, an old app would call them).
6. Reload the PostgREST schema cache (Supabase dashboard > API > reload, or `NOTIFY pgrst, 'reload schema';`). Until then attribution and the new RPC signatures are not visible to the API.

## Dry run on the live database without keeping anything
Run in a transaction that is rolled back (needs a human at a SQL console; do not use the migration tool):
```sql
begin;
\i supabase/migrations/20261114100000_heatmap_analytics.sql
\i supabase/migrations/20261117100000_heatmap_campaign_filter.sql
\i supabase/migrations/20261117200000_video_session_campaign_attribution.sql
-- checks below
rollback;
```
DDL in Postgres is transactional, so a failure leaves nothing behind. It takes brief locks on the analytics tables; do it off-peak.

## Checks after applying
```sql
select proname, pg_get_function_identity_arguments(oid) from pg_proc where proname like 'video_heat%' or proname = 'attribute_video_session_campaign';
select has_function_privilege('anon', 'public.attribute_video_session_campaign(text,text,text)', 'execute');   -- expect false
select has_function_privilege('service_role', 'public.attribute_video_session_campaign(text,text,text)', 'execute'); -- expect true
```
Then run the Supabase security advisor and confirm no new warnings on the new tables/functions; open the Heatmaps tab as an owner (data appears after new views are recorded; a campaign picker appears only when campaigns are linked).

## Netlify and Clerk (cannot be checked from this repo)
- Deploy preview of PR #171 must build (needs enough build memory: local `vite build` needed a 12 GB heap).
- `video-events` function: send one batch to the preview URL with and without `recipient`; both must return the same shape.
- Clerk: heatmap RPCs are owner-only. Sign in as the video owner on the preview and as another user; the other user must get a permission error (42501).

## Update 2026-11-17 (after merging develop and a Netlify preview)
- The `video-events` function now tolerates a missing `ingest_video_heat_events` (HTTP 404 from PostgREST): regular events are recorded and the batch returns 200, so deploying the app before the heatmap migration no longer returns 502 to viewers. Heat events are dropped until the migration is applied.
- The owner Heatmaps tab calls the new `video_heat_*` functions; before the migration it shows its load-error state (owner-only, no viewer impact).
- Our migrations replace two live functions, `delete_video_analytics(text)` and `prune_video_analytics(integer)`. The live versions were read on 2026-11-17: the replacements keep every existing statement and only add the per-second table (`video_watch_seconds`), and keep the existing grants shape (delete: authenticated owner check inside; prune: service_role).
- Netlify build: the main Vite build no longer fits in a 4 GB heap after the merge with develop (develop alone peaks near 7.8 GB RSS, this branch near 9 GB). `package.json` now builds with `--max-old-space-size=6144`; the deploy preview of PR #171 built successfully with that setting.
