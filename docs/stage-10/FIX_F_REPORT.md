# Stage 10, Fix F report: watch-page Play queue, per-cell heatmap privacy, live-Supabase hardening compatibility

Branch `claude/focused-brown-9xfv3c-fixF` (worktree `/home/user/wt-fixF`), nothing pushed. Everything below was run in this session unless marked **not run**.
Machine note: 4 shared cores, load average 6-10 from other agents' browsers, so real-browser runs were slow; the harness checks that depend on timing are clock-driven and have a retry for a stalled software-rendered player (same safety net as Stage 9).

## 1. Watch page: a Play pressed before the player is bound was lost

### Root cause (two windows, not one)
Stage 9 attributed it to `createPreviewEngine().play()` being `player?.play()` (window B below). Reproducing it in the real page showed a second, earlier window:
- **A. before the buttons are wired.** `mountWatchPage()` writes the markup (the big-play overlay is visible and clickable), then `await import('previewEngine.jsx')`, and only afterwards attaches the click/keyboard handlers. A press in that gap hits a dead button. This was the common case within ~1 s of load (observed with a debug script: after the press the label stayed "Play", no pending state, and nothing ever started).
- **B. after the wiring, before the Remotion `<Player ref>` binds.** `interactivePlayer.play()` sets `playing = true` and calls `engine.play()` which was `player?.play()` on a null player: silently dropped while the UI said "Pause".

### Fix (additive, small)
- **New** `src/lib/editor/publish/earlyPlay.js` (51 lines): `captureEarlyPlay(container)` is installed right after the markup exists and keeps ONE boolean intent (big-play => play, control-bar button / Space / `k` => toggle, the same semantics as the real handlers; keyboard on a focused button is left to the native click so it cannot toggle twice). While pending the stage carries `data-play-pending`, the big-play is hidden and the control bar shows Pause. `release(player)` runs once when everything is wired: removes its listeners, clears the pending state, and calls `player.play()` exactly once if the intent is "play".
- `src/lib/editor/remotion/previewEngine.jsx` (+13/-2, the player wrapper): `play()` before bind sets a `pendingPlay` flag (and `data-play-pending` on the host); `bind()` starts it exactly once after `onReady`; `pause()`/`destroy()` cancel it; exposes `playPending`.
- `styles/watch.css` (+5): spinner for `.watch-stage[data-play-pending]` (respects `prefers-reduced-motion`).
- **`src/pages/WatchPage.jsx`: exactly 3 added lines, nothing else changed** (for merge conflicts with other branches editing the file): line 17 `import { captureEarlyPlay } from '../lib/editor/publish/earlyPlay.js';`, line 97 `const early = captureEarlyPlay(container);` (right after `const frame = $('[data-frame]');`), line 196 `early.release(player);` (immediately before the final `return player;`). `interactivePlayer.js` is **not touched**.

### Tests
- `src/lib/editor/remotion/__tests__/previewEnginePendingPlay.test.js` (3 tests; fails without the engine change): queue + single fire + double press + re-bind no replay, pause cancels, destroy clears.
- `src/lib/editor/publish/__tests__/earlyPlay.test.js` (3 tests; the `mountWatchPage` one fails without the WatchPage lines): intent queue, toggle/cancel, and a `mountWatchPage` run that presses big-play twice while the engine module is "loading" (a getter on `deps.createEngine` fires the click after the markup exists and before anything is wired) and asserts one `engine.play()`, `player.playing`, label Pause, no pending attribute.
- Real page: `tests/browser-harness/heatmaps/watch-real.mjs` now has an "early Play" section (3 viewers: big-play overlay, control-bar button, Space on the page). Every attempt first asserts the stage has no `.__remotion-player` at press time; then asserts label "Pause" at press, `data-play-pending` was seen, the clock reaches 0:02, pending cleared, exactly one `watch_buckets` range starting at 0, and that `watch_buckets` was sent. The check is retried (max 4) only for a stalled player or a late flush, never for a lost press.

## 2. Heatmap privacy: per-cell suppression and complementary disclosure

All in the same unapplied migration `supabase/migrations/20261114100000_heatmap_analytics.sql` (idempotent, applied twice in the harnesses).

**Threshold K defined once**: `public._heat_min_cohort()` (`select 5`), plus `_heat_ok(n)` = `n = 0 or n >= K`. A unit test asserts the literal `5` appears in the SQL once as the function body and no other `< 5` / `>= 5` exists. The UI reads `min_cohort` from the RPC result.

Rules (also in the SQL header comment):
1. View level (unchanged): fewer than K distinct sessions => `{suppressed:true}`, no distribution.
2. Cell level: every displayed non-zero count rests on >= K **distinct sessions**; a smaller cell is merged or withheld, never shown.
3. Complementary disclosure: totals are sums of DISPLAYED cells only; partitions are merged until each part is >= K; a withheld cell is signalled only by a boolean, never a count or a position.

| RPC | What changed |
|---|---|
| `video_heat_clicks` | 50x50 fine cells shown only with >= K distinct sessions. Events of smaller cells are merged into 10x10 blocks (5x5 cells), shown (`coarse`) if the merged events come from >= K sessions; the rest form one `other` pool, shown only if >= K sessions, else only `withheld: true`. `clicks` = sum of what is returned (never the true total when something is withheld). Page-height buckets with < K sessions are not listed (`page_buckets_other` only if the pool >= K). |
| `video_heat_cta_stats` | impressions < K: row `suppressed`, no numbers. Clicks in 1..K-1 (previously shown, e.g. "1 click") are withheld: `clicks:null, clicks_suppressed:true, ctr:null`. No totals row exists. |
| `video_heat_scroll` | Sessions fall into 5 disjoint bands by deepest milestone. `reached[m]` is returned only where the bands above m form groups that are each >= K (or empty); a small band is merged into its deeper neighbour, so no band is the difference of two shown values (`reached[m] = null` = merged; `bands` lists the groups). `cta_exposed_sessions` is withheld if either "saw a CTA" or "saw none" is in 1..K-1. |
| `video_heat_engagement` | Per-second viewers/replays/skips of 1..K-1 are `null` (0 is shown). The series stops at the last second watched by >= K viewers (its length no longer reveals how far one single viewer got). Per-second drop-off is replaced by `dropoff_bins` (consecutive second ranges merged until each has >= K sessions; they partition all sessions). |

UI (`src/lib/editor/projectLibrary/analytics/`): merged blocks are drawn as faint areas with a dashed outline (no precise spot), a "Privacy" note explains blocks, the pool and "Some clicks are withheld" (position and number are not shown; the total counts what is shown). Withheld seconds in the engagement strip are hatched (and counted in the note); drop-off is a red bar under the strip spanning the busiest bin; CTA cells show a hatched `<5` and "hidden" CTR; scroll steps show a hatched "merged" bar. The notes are inside the report, so they print. CSV: `level` column (`cell`, `merged_block`, `other_merged`, `withheld` with `<5`), CTA/engagement cells `<5`, scroll `merged`, drop-off as bin id + bin sessions; nothing for a suppressed view (header only). Formula-injection guard unchanged.

### Tests added / run
- `supabase/tests/70_heatmap_assertions.sql`: **new fixture `vidA000003` (12 sessions)** and 17 new assertions: threshold defined once; a 6-session fine cell is exact; five single-session cells in one block become ONE coarse block of 5 and no fine cell is exposed; a lone click (1 session) is absent from cells/coarse/other (only `withheld`); displayed `clicks` = 11 of 12 (the withheld one cannot be recovered by subtraction); page bucket with 1 session unlisted; CTA c1 (12 impressions, 3 clicks) withholds clicks and CTR, c2 (2 impressions) suppressed, c3 (8/6) shown with CTR 0.75; scroll bands 0/1/2/1/8 merge fully, scenario 0/0/5/2/5 shows 12/12/null/5 (no shown difference < K), scenario "2 sessions saw no CTA" withholds the exposure figure; engagement series ends at 4 seconds although one session watched to second 9, replays `[6,null,0,0]`, drop-off single bin `[0,3,12]`. Existing assertions adjusted (dropoff bins; direct raw reads are now denied, see section 3).
- `src/lib/editor/projectLibrary/analytics/__tests__` (heatmapData, HeatmapsSection incl. a new "shows suppressed cells distinctly and explains them" test) and `src/test/heatmap-migration.test.js` updated.

## 3. Compatibility with the live Supabase hardening

I do not have the live migrations; this is what the new migration now guarantees on its own, and how I simulated the hardening.

Changes to the migration:
- **No client grants or policies on the three new tables; RLS enabled** (`enable row level security` + `revoke all ... from public, anon, authenticated`, sequence revoked too). **This deviates from "owner policies on every new table" on purpose**: an owner SELECT policy on `video_heat_events` / `video_heat_sessions` / `video_watch_seconds` would let any owner read the raw per-session click coordinates and per-second counts through PostgREST and bypass all the small-cell rules above. Owners read only through the aggregated owner RPCs (SECURITY DEFINER, owned by the migration role, so they need no table grants). Nothing in the repo reads these tables directly (grep). If you want owner SELECT policies back (like the 20261112* tables) it is a 3-line change, but the cohort rules then protect only the RPC path.
- Owner RPCs: `revoke all ... from public, anon, authenticated, service_role` then `grant execute ... to authenticated` only (was `anon, authenticated`). The writer `ingest_video_heat_events`: revoked from `public, anon, authenticated`, granted to `service_role` only. New helpers `_heat_min_cohort`, `_heat_ok`, `_heat_assert_owner`: revoked from everyone (they are called inside definer functions). Redefined `prune_video_analytics` (service_role) and `delete_video_analytics` (now authenticated only, was `anon, authenticated`).
- `set search_path = ''` on every SECURITY DEFINER function (they already had it; now asserted in SQL and in a unit test).
- Nothing relies on default privileges (no `alter default privileges`, no assumption that new objects are public).
- Dependency to verify live: the owner RPCs run as definer and read `public.published_videos` themselves, so they do not depend on its RLS; the RPCs rely on Clerk's JWT `role` being `authenticated` (the existing `video_retention_curve` / `video_section_engagement` grants already assume this).

Simulation: `supabase/tests/05_hardening_preamble.sql` (applied by `HARDEN=1` in `run-assertions.sh` and `run-heatmap-assertions.sh`, after the older migrations and before the heatmap migration): grants the Supabase baseline defaults to `anon, authenticated, service_role`, then `alter default privileges in schema public revoke all on tables/sequences/functions from public, anon, authenticated`, `alter default privileges revoke execute on functions from public`, and enables RLS on every existing public table. **Not simulated**: revoking PUBLIC/anon EXECUTE on the *older* functions (my first attempt broke the older `slug_is_valid` CHECK helper in `published_videos` inserts, which is an artifact of the blunt simulation, not of the new migration; the live `restrict_public_function_access` content is not in this repo, so I cannot reproduce it exactly). The heatmap assertions end with ACL checks (no PUBLIC/anon EXECUTE on any new/redefined function; owner RPCs authenticated-only; writer service_role-only; helpers nobody; no table ACL/policy; every definer function pins `search_path`).

## Commands run and results
(Postgres 16 cluster `main`, run as the `postgres` OS user.)
- `HARDEN=0 supabase/tests/run-heatmap-assertions.sh`: ALL HEATMAP ASSERTIONS PASSED; `HARDEN=1`: ALL HEATMAP ASSERTIONS PASSED.
- `HARDEN=0 supabase/tests/run-assertions.sh`: ALL ASSERTIONS PASSED; `HARDEN=1`: ALL ASSERTIONS PASSED.
- Unit tests: `npx vitest run src/lib/editor/publish src/lib/editor/projectLibrary src/lib/editor/remotion src/test/heatmap-migration.test.js src/test/personalization-analytics.test.js netlify/functions`: 91 files passed, 1 skipped, 1153 tests passed, 2 skipped, 0 failed (before the final harness-only commits; no source changed after).
- Real WatchPage harness `watch-real.mjs` (vite :3151, Chromium 153, real handler + Postgres 16): **28 checks, 28 passed, 0 failed**, including the 3 early-Play checks (big-play, button, Space; each pressed with no Remotion player in the stage, pending shown, playback started, one range from 0, `watch_buckets` sent). Earlier runs while I was editing src failed for the reason in Harness notes. Without the `WatchPage.jsx` lines the press was lost (observed with a debug script: label stayed Play, nothing started); I did not re-run the full harness on the pre-fix tree.
- `tests/browser-harness/heatmaps/e2e.mjs` (built with `build.cjs`, DB heatF2): **19 checks, 19 passed, 0 failed** (includes the bin-based drop-off and withheld-aware click totals).

## Harness notes
- Do not edit files under `src/` or `styles/` while `watch-real.mjs` runs: the vite dev server full-reloads the open pages and the harness then sees two sessions in one page (this produced two false "7 sessions" runs while I was editing; the session-count check now compares with the sessions the pages actually sent).
- `tests/browser-harness/heatmaps/{e2e.mjs,build.cjs,entry-*}` pointed at `/home/user/wt-stage7`; they are now repo-relative (`__ROOT__` placeholder in the entries, `HEAT_S`, `HEAT_Q`, `DB` env).

## Limitations / not done
- Differencing across overlapping filters or date ranges (the same view for 7 and 8 days, or with and without a device filter) can still reveal a small group; not prevented (an owner can also see their own raw `video_events`/`video_view_sessions` rows through the pre-existing 20261112* owner policies, which this change does not touch).
- Per-second viewers/replays/skips of the same second (overlapping sets) are suppressed per value only; adjacent-second differences of viewers are not merged (they are not disjoint cells).
- Scroll merging is conservative (a small leftover band merges everything below the deepest group), so a page with few sessions can show "merged" for all intermediate steps.
- Firefox/WebKit not installed (Chromium 153 only). Live Supabase/Netlify/Clerk not touched; the live hardening migrations were not available, so the ACL/RLS behaviour is verified against a simulation, not against the live project.
- `eslint`, `tsc`, the full `npx vitest run` and `npm run build` were not run.
