# Published interactive URL — what a real test needs

Status: **not verified live.** The sandbox has no Supabase project, no Clerk session and no deployed Edge Functions, so no lead
submission, webhook delivery, view tracking or published-player run was executed against real infrastructure. Everything below is
what a real test requires.

## Client environment (Vite)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (`src/lib/supabase.js`; without them the app logs "Missing required environment variables")
- `VITE_SUPABASE_TOKEN_FUNCTION_URL` (token exchange used by `refreshUserHeader`, `src/lib/supabase.js`)
- Clerk publishable key for the host app (the share panel refuses to publish unless `window.Clerk.user` exists: "Sign in to publish videos")

## Database (apply in order, `supabase/migrations`)
- `20261104120000_create_video_leads.sql` — `public.video_leads` (RLS: rows owned by the publishing user)
- `20261105120000_create_published_videos.sql` — `public.published_videos` (snapshot JSON, slug id, `published`, `view_count`)
- `20261105130000_tighten_timeline_table_grants.sql`
- `20261105140000_video_leads_call_attempts.sql` — adds the `call-attempt` kind (click-to-call notify)
- `20261105160000_published_video_events.sql` — view / interaction events used for tracking

## Edge Functions to deploy
- `lead-capture` — secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; optional `LEAD_CAPTURE_ALLOWED_ORIGINS`
  (default `*`). Stores the lead for the video owner (published id path uses the service role), forwards to up to 3 https webhooks
  saved in the published project, rate-limits 20/min.
- `create-share` — secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## Test steps once the above exists
1. Sign in with Clerk, publish a `#/timeline` project from Export → Share (`share-panel.tsx` → `publishClient.publishVideo`).
2. Open `/watch/<id>` in a second browser profile (not signed in).
3. Check: tel: link on the call button (and a `call-attempt` row), End Screen button links, Lead Generator gate pause/submit/skip,
   List Builder/Personalizer answers, Skip/Pause/Loop clips.
4. Confirm `video_leads` rows for the owner and a hit on a request-catcher webhook URL (use a throwaway URL such as a webhook.site endpoint).
5. Confirm `published_video_events` rows and `view_count`.

## Not found in the code (needs a product decision before a "consent" test)
No consent banner or viewer-identification requirement was found in `src/lib/editor/publish/*` or `WatchPage.jsx`; tracking is
anonymous event logging. If consent gating is required it must be added, not just tested.
