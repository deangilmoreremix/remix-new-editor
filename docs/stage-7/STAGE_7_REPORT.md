# Stage 7 report: heatmap analytics and engagement intelligence

Branch `claude/focused-brown-9xfv3c-stage7` (worktree `/home/user/wt-stage7`). Nothing pushed.

## What shipped

| Sub-feature | Status |
|---|---|
| 7.1 Click capture | Done, verified in real Chromium |
| 7.2 CTA impressions + typed CTAs | Done, verified in real Chromium |
| 7.3 Per-second watch buckets | Done, verified (browser -> handler -> real Postgres) |
| 7.4 Scroll depth | Done, verified |
| 7.5 Migration + RPCs | Done, applied twice on Postgres 16, 36 SQL assertions pass |
| 7.6 Heatmaps UI | Done, all controls functional (jsdom + real browser) |
| 7.7 Tests | Done (counts below) |
| 7.8 Report | This file |

### Capture (watch page)
- `src/lib/editor/publish/heatmapCapture.js` (new) rides on the existing `createAnalytics()` (only calls `analytics.track`), so batching, retry, `(session, seq)` idempotency and the consent gates (DNT, GPC, `?consent=`) are the existing ones. When analytics mode is `off`, nothing is observed.
  - `heat_click`: `x`,`y` in 0..1 of the watch-page container, page-height bucket (400 px units), viewport class (`<600` mobile, `<1024` tablet, else desktop), CTA clip id + kind + the owner's label (from `ctaLabels(project)`, never DOM text). Dedupe: same 1% cell within 400 ms dropped; cap 30 clicks per session (client and server). Clicks on inputs/textareas/selects and keyboard-activated clicks are ignored.
  - `cta_impression`: IntersectionObserver, >= 50% visible, once per session per CTA. Observes `a.wf-cta`, `a.wf-linkbox` and the lead form (`form.addon-optin`, keyed by the project's single lead-form clip id).
  - `scroll_depth`: 25/50/75/100 once each (bottom of viewport / page height; what is visible on load counts, so a page that fits the screen reports 100).
  - `watch_buckets`: `[[firstSecond,lastSecond],...]` per continuous play-through, flushed at run end / every 30 s / on hide. Never per tick.
- CTA kinds (`book_call, visit_website, call_now, get_offer, contact, lead_capture, other`) are derived in `heatmap/geometry.js` from `tel:`/`mailto:`, the lead form and the owner's label wording. Unknown labels stay `other`; an http(s) link with an unrecognised label is `visit_website`. Old data without kinds is shown as `other`; CTR is never computed without impressions.
- `netlify/functions/video-events.js`: allow-list extended (`heat_click`, `cta_impression`, `scroll_depth`, plus `watch_buckets`), strict per-type props shaping (unknown keys dropped), heat events routed to the new RPC after `ingest_video_events` (which always runs, also with an empty list, to create the session row).

### Database (`supabase/migrations/20261114100000_heatmap_analytics.sql`)
- New tables, owner-select-only RLS (same Clerk `sub` via `published_videos.clerk_user_id` convention as the 20261112* analytics tables), writes revoked: `video_heat_sessions` (per-session aggregates: viewport, scroll, per-second counts), `video_heat_events` (bounded raw rows: click / impression / scroll milestone), `video_watch_seconds` (aggregated per video/day/viewport/second: viewers, replays).
- `ingest_video_heat_events(video, session, events)` service_role only. Bounds: 30 clicks, 100 heat rows, 600 seconds per event, wall-clock sanity bound on watch seconds (`elapsed*1.1+10`), unique-per-session impressions and scroll milestones, idempotent by `(session, seq)`.
- Owner RPCs (security definer, `search_path=''`, explicit ownership check raising 42501): `video_heat_clicks` (50x50 grid), `video_heat_cta_stats`, `video_heat_scroll`, `video_heat_engagement` (viewers/replays/skips/drop-off per second). Minimum cohort 5 distinct sessions: below it the RPC returns `suppressed` and no distribution.
- Retention: `prune_video_analytics` and `delete_video_analytics` are re-created (existing behaviour kept, `video_watch_seconds` added). Heat sessions/events cascade from `video_view_sessions` (90 days). Tables/functions carry the `[smartvideo-timeline-editor]` comment label.
- No change to `ingest_video_events` or any existing table.

### UI
- `HeatmapsSection.jsx` + `heatmap/{heatmapRenderer.js,HeatmapCanvas.jsx,heatmapData.js}` + `styles/heatmaps.css`, mounted as a new "Heatmaps" tab through an optional `renderHeatmaps` prop of `SmartVideoAnalytics.tsx` (wired in `AnalyticsTabView.jsx`, which is also what the CineGen Analytics tab mounts, so both paths get it).
- Controls: type (click / CTA / video engagement / scroll), date range (7/30/90 + custom), video (owner's published videos), CTA (click view), device (viewport class), intensity slider (redraw, no refetch), overlay on/off, Export CSV (formula-injection-safe, nothing exported for suppressed sets), Print report (`@media print` shows only the report). Campaign filter omitted: campaign data does not exist on this branch.
- Video engagement is a 1-D canvas strip (colour = viewers per second, white bars = replays, red marker = peak drop-off) from real playback data.

## Access path
Owner: Projects > project > Analytics tab > "Heatmaps" tab (also CineGen Analytics tab, same component). Viewers: capture is automatic on `/watch/<id>` and `/v/<biz>/<slug>`.

## Upstream reused
heatmap.js (pa7/heatmap.js @ 4e64f5ae5754c84fea363f0fcf24bea4795405ff, MIT, (c) 2015 Patrick Wied): the technique only (per-point radial-gradient alpha "shadow" then 256-colour gradient palette lookup, default blue/green/yellow/red gradient). The renderer is a fresh in-house ES module, no upstream code copied, **no npm dependency added**, none of its scripts run. Attribution is in the header of `heatmapRenderer.js`. Added over upstream: normalized 0..1 coordinates, DPR handling, pure unit-testable palette/alpha/colorize math.

## Files
New: `src/lib/editor/publish/heatmapCapture.js`, `src/lib/editor/publish/heatmap/geometry.js`, `src/lib/editor/projectLibrary/analytics/HeatmapsSection.jsx`, `.../analytics/heatmap/{heatmapRenderer.js,heatmapData.js,HeatmapCanvas.jsx}`, `styles/heatmaps.css`, `supabase/migrations/20261114100000_heatmap_analytics.sql`, `supabase/tests/{70_heatmap_assertions.sql,run-heatmap-assertions.sh}`, `tests/browser-harness/heatmaps/*`, tests listed below, this report.

**Touched existing files (all additive):**
- `src/pages/WatchPage.jsx` (hot): +1 import, +1 line creating `heat`, +1 line `heat.onPlayerChange(...)` in `onChange`, pagehide handler now also calls `heat.destroy()`. 5 insertions / 1 modification.
- `netlify/functions/video-events.js`: allow-list, `normalizeHeat`, routing of heat events to the new RPC.
- `src/lib/editor/projectLibrary/analytics/SmartVideoAnalytics.tsx`: optional `renderHeatmaps` prop and a conditional 4th tab (no change when the prop is absent).
- `src/lib/editor/projectLibrary/analytics/AnalyticsTabView.jsx`: import + passes `renderHeatmaps`.
- Not touched: `interactivePlayer.js`, `publishClient.js`, `analyticsClient.js`, `analytics-tab.tsx`, `projectsPanel.js`.

## Tests (all run in this session)
- Targeted new/changed files: see counts in the final section of this file ("Run results").
- `supabase/tests/run-heatmap-assertions.sh` on a throwaway Postgres 16 (migration applied twice first): **36 assertions, ALL PASSED**: owner A vs B isolation on all new tables and RPCs, anon denied, ingest RPC not callable by anon/authenticated, forged writes denied, idempotent retry, click cap 30, cohort suppression (<5), prune at 90 days (cascade + per-second table), owner delete clears everything.
- Real-browser check (Playwright Chromium 153, `tests/browser-harness/heatmaps/e2e.mjs`), **19 checks, all passed**: real mouse clicks -> normalized coords/CTA id/kind/label, duplicate dropped, form field not recorded, no text or form value in any request body, CTA impression once, scroll milestones 25/50/75/100 once, watch buckets as ranges, DNT -> zero requests; batches pushed through the real `video-events.js` handler into real Postgres, owner RPCs read back (clicks 18 from 6 sessions, impressions 6, per-second viewers/replays/drop-off exact); React section rendered at DPR 2 (backing store = CSS width x 2, hot pixels present, corner transparent), intensity and overlay controls, engagement strip, CSV download, print stylesheet (controls hidden, report visible).
- The Postgres harness `tests/browser-harness/projects-analytics` itself (seed.py/bridge) was not run; the equivalent real-Postgres RLS checks were done with the new `supabase/tests` assertions instead.
- Existing `supabase/tests/run-assertions.sh` was not re-run against the redefined `prune_video_analytics`/`delete_video_analytics` (it does not apply the new migration); the new script covers their behaviour.

## Privacy notes
- Stored: normalized coordinates, page-height bucket, viewport class, CTA id/kind/owner label, scroll milestone, per-second counts. Not stored: element text, selectors, form values, keystrokes, pointer movement, IPs, any new identifier. Sessions stay anonymous (same session key); the existing `?c=` contact link is not joined to heat data in any RPC.
- Honours DNT / GPC / `?consent=0|off|no` (nothing observed or sent); `?consent=essential|anonymous` still captures (no viewer id, as before).
- Cohort threshold 5 sessions per view; below it nothing is shown or exported. Cells are not suppressed individually (limitation: with exactly 5 sessions a cell can reflect one person's click position).
- **Pointer-movement heatmap omitted by design**: movement traces approximate per-person reading behaviour and are far more invasive than discrete clicks; they are not eye tracking and give a misleading signal. Clicks, impressions and scroll answer the same business questions.
- Retention 90 days (raw/heat rows via session cascade; per-second table explicit prune); owner delete clears all.

## Limitations
- The heatmap backdrop is a schematic (thumbnail or wireframe) sized from the page-height bucket and nominal device width, not a screenshot of the real layout.
- Per-second arrays are capped at 1 hour (3600 s); longer videos are not counted past that.
- `watch_buckets` are bounded by wall-clock time since the session row was created (first flush ~2 s after open), so a seek-heavy burst can be partly dropped; this mirrors the existing `watch` guard.
- Lead-form impressions only join to clicks when the project has exactly one lead-form clip.
- Impressions exist only for views after deploy; older sessions show no CTR (`—`), never an inferred one.
- Video selection lists the owner's published videos; campaign filter, hover tooltips on the heatmap and per-cell cohort rules are not built.
- No custom keyboard/AT alternative to the canvas besides the aria-label, summary text and CSV/table views.

## Needs live Supabase / Netlify to verify
- Applying the migration on the real Supabase project and that `service_role` EXECUTE on `ingest_video_heat_events` works with the real PostgREST role setup; pg_cron nightly prune picks up the extended `prune_video_analytics`.
- Clerk JWT `sub` flowing through `auth.jwt()` into the new definer RPCs from the real signed-in client.
- Netlify function deploy (body limit 8192 B with `watch_buckets`, rate limits `rate_limit_check` with the extra calls per batch).
- The real watch page in a real published video (the browser check used a synthetic page with the real capture/analytics modules, not `WatchPage.jsx` end-to-end).

## Run results
- 7 new test files, **67 tests, all passed** (`video-events-heat`, `heatmapGeometry`, `heatmapCapture`, `heatmapRenderer`, `heatmapData`, `HeatmapsSection`, `heatmap-migration`).
- Related areas re-run together (video-events, publish, projectLibrary analytics, `src/cinegen`, migration test): 214 files, 1550 passed, 27 skipped, **1 failed**: `src/cinegen/__tests__/timeline-parity.test.ts` (`timeline-editor.tsx` line-budget), the same pre-existing failure recorded in the Stage 0 baseline; unrelated to this stage.
- Full `npx vitest run` (finished after the first version of this report): 774 files, **772 passed, 2 failed**; tests **11230 passed, 2 failed, 61 skipped** (11293). The 2 failures are the same two pre-existing Stage 0 baseline failures (`timeline-parity.test.ts`, `legacyCards.test.ts`). `tsc`, `eslint` and `npm run build` were not run.
