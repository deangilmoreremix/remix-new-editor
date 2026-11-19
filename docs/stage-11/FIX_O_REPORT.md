# Fix O: campaign filter for heatmaps

Branch `claude/focused-brown-9xfv3c-fixO` (base 2b7c6bddb). Nothing pushed or merged. No live Supabase project was touched; all SQL ran on a throwaway local Postgres 16.

## What the unmerged branches actually provide (read with `git show`, not merged)

`origin/claude/modest-tesla-yhjel6` (one commit, 280a35ff5, "Personalized Video studio shell and campaigns schema"):
- `supabase/migrations/20261113000000_video_campaigns.sql` defines `video_campaigns` (id, clerk_user_id, name, base_video_url, cta, status...) and `campaign_recipients` (campaign_id, clerk_user_id, email, contact, `public_token`, status, `output_video_url`, thumb), owner RLS on the Clerk `sub`, and the anon RPC `get_campaign_recipient_page(token)`.
- JS: `PersonalizedVideoStudio.js`, `personalizedVideoEngine.js`, routes (`/p/<token>`), one engine test. No analytics code.
- **It has no link between a video view session and a campaign.** Nothing references `video_view_sessions`, `published_videos`, `video_events`, `video_heat_*`; recipient videos are plain `output_video_url`s, and no watch-page/ingest change records the token.

`origin/claude/upbeat-goodall-9lmvej`: `src/lib/editor/publish/attribution.js` captures `utm_source/medium/campaign/term/content` and the referrer, but sends them with **leads** only (free text `utm_campaign`, not a campaign id, not on view sessions).

The existing `video_view_sessions` has `contact_id` (`?c=` link) and `referrer_host`, nothing campaign-shaped.

Conclusion: no equivalent exists, and the linkage can only be defined by the campaign work. So this fix **implements the contract plus a call-time check, and does not add the column**: nothing would write it, and a permanently empty column would show a filter that filters nothing.

## Contract (assumed, not provided by any branch)

`public.video_view_sessions.campaign_id` (nullable; uuid, text also works since it is compared as text), filled by whatever records the view (e.g. ingest resolving the recipient `public_token` or a `?campaign=` id to `campaign_recipients.campaign_id`). Optional niceties used if present: `video_campaigns(id, name, clerk_user_id)` supplies names in the selector (only the caller's own campaigns).

## What changed

- `supabase/migrations/20261117100000_heatmap_campaign_filter.sql` (new; Stage 7 migration untouched, idempotent, applied twice in tests):
  - `_heat_campaign_linked()` checks `information_schema.columns` at call time. `_heat_campaign_scope()` runs dynamic SQL, so the migration applies and the RPCs run whether or not the column exists (plpgsql never references the column statically).
  - The four owner RPCs get a trailing `p_campaign uuid default null`. The old signatures are **dropped and replaced**, because keeping both would create overloads PostgREST cannot disambiguate when the argument is omitted. Calls without `p_campaign` (positional or named, 3/4/6 args) behave exactly as before (asserted: explicit `null` equals unfiltered output byte for byte, before and after adding the column).
  - Engagement with a campaign uses `video_heat_sessions.sec_counts` (per session) instead of the day/viewport aggregate `video_watch_seconds`, which has no session dimension.
  - New `video_heat_campaign_options(video)`: `{available:false}` without linkage; otherwise campaign ids that have sessions on this video (no counts), names from `video_campaigns` when possible.
  - A non-null campaign without linkage raises 0A000 `campaign_filter_unavailable` (never silently returns unfiltered data). The UI never sends it in that case.
  - Grants unchanged: new RPCs executable by `authenticated` only, helpers by nobody, owner check (`_heat_assert_owner`, 42501) first in every RPC, `search_path=''`, RLS/table grants untouched.
- Small-cohort rule for the filter (differencing): a campaign view is released only if (a) the campaign has >= K=5 sessions in the same video/date/device scope, and (b) the sessions outside it, with every group under K (including "no campaign") pooled, number 0 or >= K. Otherwise the scope is empty and the usual `suppressed` answer returns (0 sessions, indistinguishable from no data). Then total minus any displayed campaign is a sum of groups that are each 0 or >= K. The existing per-view rules (cells, bins, bands, CTA rows) still apply inside the campaign view.
- UI: `HeatmapsSection.jsx` shows a "Campaign" select only when `video_heat_campaign_options` says available (missing RPC, error, `available:false`, empty list: hidden, no banner). `p_campaign` is sent only when a campaign is selected, so an app deployed before the migration keeps working. `heatmapData.js`: `loadCampaignOptions`, `campaign` arg of `loadHeatmap`.

## Tests run (all in this session)

- `supabase/tests/run-heatmap-assertions.sh` (now also applies the new migration twice and runs `71_heatmap_campaign_assertions.sql`), both plain and `HARDEN=1`: Stage 7 assertions (36) still pass unchanged, plus 36 new ones: no-linkage phase (options false, old call shapes, error on filter, no extra overloads), TEST-ONLY shim phase (adds `video_view_sessions.campaign_id` and a minimal `video_campaigns`; filtering by campaign on all four RPCs, composition with CTA filter, unfiltered results identical before/after the column exists), explicit differencing tests (6-session campaign + 3 unattributed is withheld; small groups pooling to 6 allows the big campaign, a 3-session campaign stays withheld; device-scope gate; sweep asserting no campaign view ever reports 1..4 sessions), owner isolation (B gets 42501), anon/no-JWT denied, grants and search_path.
- Real Chromium + real Postgres: new `tests/browser-harness/heatmaps/campaign-e2e.mjs` (+ `entry-campaign.jsx`, `build.cjs` entry): 12 checks pass (control hidden without linkage; appears with names with shim; filtering to 6 and 5 sessions; persists across views; withheld view shows "Not enough data" with 0 sessions and no canvas). Existing `e2e.mjs`: 19/19 still pass.
- vitest: `src/lib/editor/projectLibrary` + `src/lib/editor/publish`: 21 files, 202 tests pass (includes new `HeatmapCampaignFilter.test.jsx`); `src/test/heatmap-migration.test.js` and the new `src/test/heatmap-campaign-migration.test.js` pass.
- eslint (`NODE_OPTIONS=--max-old-space-size=6144`) on the changed `src` files: clean. The `tests/browser-harness` scripts are not covered by the repo's eslint config (the existing `e2e.mjs` is in the same state).

## Not verified / limits

- Live Supabase: not touched. Applying the migration there, PostgREST resolution of the new signatures (a PostgREST schema-cache reload is needed after migrating; until then the old signature is gone, so deploy migration and app together), and the Clerk `sub` path are unverified.
- The linkage itself is **assumed**. No code writes `video_view_sessions.campaign_id`; until the campaigns work does, the control stays hidden in every real database. The shim table/column exist only in the test files.
- Differencing protection covers the campaign dimension within one date range/device. Overlapping date ranges or device filters across calls remain the documented Stage 7 residual risk. The CTA click filter inside a campaign view is not part of the gate.
- Campaign filtering casts `campaign_id` to text, so a campaign-filtered query cannot use an index on that column (fine at the 90-day retention scale; add an index in the migration that creates the column).
- Campaign list in the selector is capped at 50 ids per video; names appear only when `video_campaigns(id,name,clerk_user_id)` exists.
