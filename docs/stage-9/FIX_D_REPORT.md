# Stage 9, Fix D report: parity budget, lint, typecheck, real watch-page run, SQL checks

Branch `claude/focused-brown-9xfv3c-fixD` (worktree `/home/user/wt-fixD`), nothing pushed. Everything below was run in this session unless marked **not run**.
Machine note: 4 cores shared with other agents' browsers (load average 6-10), so real-browser runs were slow and a few timing details in the harness are clock-driven rather than sleep-driven.

## 1. timeline-parity (`timeline-editor.tsx` 224 > 220)

Why: the vendored CineGen baseline differs from our `src/cinegen/components/edit/timeline-editor.tsx` only by host features (the failure predates Stage 1: Stage 8 measured it as 224 on the merged tree, the test counted 228 on this tree after the Template videos merge). The host lines were: desktop-file drop handler, Library drag-and-drop capture handlers (inline JSX), Alt-drag rate stretch, Smart Speech, Template Generator, Personalization hub, plus the Overlays/Captions lanes, Add modal and small markers.

Fix (the preferred one, test and budgets untouched): the host-only handlers moved to a new file `src/cinegen/components/edit/timeline-host-actions.ts`:
`rateStretchTimeline()` (pure), `useHostTimelineActions()` (desktop drop, rate stretch, Smart Speech, generator, personalization) and `libraryDropHandlers()` (the three capture handlers on the editor root).
Difference now **97 lines** (budget 220), counted with the same algorithm as the test. `npx vitest run src/cinegen` : 213 files passed, 1631 tests passed, 30 skipped, 0 failed.

Exact lines touched in `timeline-editor.tsx` (for merge conflicts with fixA/B/C):
- imports at the top: `library-dnd` import now only `type LibraryDrag, type LibraryDropCtx`; the `template-composition` and `smart-speech` imports replaced by one `import { useHostTimelineActions, libraryDropHandlers } from './timeline-host-actions';`
- the old block `// [remix] Files dragged in from the desktop ... handleDesktopFilesDrop` (after `handleDropAsset`) replaced by a 2-line comment + one `useHostTimelineActions({...})` destructuring call;
- removed `handleRateStretch`, `handleOpenSpeech`, `handleOpenGenerator`, `handleOpenPersonalization` (the block between `handleSeek...` area and `handlePickTemplateVideo`, which stays);
- the root `<div className="timeline-editor" ref={editorRef} onDragOverCapture=... onDropCapture=...>` is now `<div className="timeline-editor" ref={editorRef} {...libraryDropHandlers({...})}>`.
A conflicting edit by another agent in those spots needs the same hunks re-applied; everything else in the file is unchanged.

## 2. Lint

`NODE_OPTIONS=--max-old-space-size=8192 npx eslint src netlify --ext .js,.jsx,.ts,.tsx --quiet`: **234 errors, all under `netlify/`; 0 under `src/`.**
- Fixed (touched by Stages 1-8): `netlify/functions/__tests__/personalization-api.test.js` (`Request/Headers/FormData/Blob` globals) and `zackd.test.js` (`AbortSignal`) via per-file `/* global */` comments, the convention of the neighbouring functions (adding config-level globals made those files' own `/* global */` lines trip `no-redeclare`).
- Not fixed, pre-existing / not Stage 1-8 code (they arrive through the merged develop sync, #135): `netlify/functions/_personalization/**` (about 170 errors: it is a TypeScript tree and `eslint.config.js` has no TS parser for `netlify/`, so most files are "Parsing error"; if a TS parser is added, about 80 more real findings show: `no-useless-assignment`, `no-useless-escape`, `no-redeclare`), plus `netlify/functions/{ask-smartvideo.mjs,digest-daily.mjs,supabase-token.js,personalization-browser-discovery.cjs,_personalizationAssets.js,_shared/askSearch.js,video-agent-generate.mjs,watch-embed.js}` (Node globals/redeclares, one `with` import-attributes parse error). I tried a TS-parser block for `netlify/**/*.ts` and reverted it because it only converts parse errors into ~80 vendored findings.

## 3. Typecheck (scoped tsc)

A temporary `tsconfig.scoped.json` (root `tsconfig` paths + `@cinegen/*`, ES2023 lib, `files` = the TS files changed by Stages 1-8, `allowJs:false` because the codebase uses `@ts-expect-error` for untyped `.js` imports). Not committed (it lists a point-in-time file set). The whole-project run is unusable (syntax errors in `packages/{layout,tokens}`).
Result: 319 errors in 1st pass, mostly config artefacts (`TS7016` untyped `.js` imports); after filtering `TS7016`, the real errors in Stage 1-8 files were fixed (type-only, commit "Type-only fixes"):
`SmartVideoAnalytics.tsx` (`engagementPercent` nullable sort, Stage 7), `workspace-shell.tsx` (`snapshot.overlays`), `use-publish.ts` (`rowId ?? ''`, same behaviour: `isLinkableProjectId` rejects both), `web-api.ts` (`qaStatus/qa` on the job type, caption font lookup), `electron.d.ts` (`export.start` now declares `videoBitrate/qa/aspect/overlays/mgOverlays/hfOverlays`, which `export-tab.tsx` already passed), and 5 test files (casts only).
**Remaining, not fixed:** `src/cinegen/components/edit/edit-tab.tsx:1185` TS17001 duplicate JSX attribute `onSeek` (off-limits: fixA/B/C own that file; the second `onSeek={seek}` is redundant, delete one); about 200 pre-existing errors in files not touched by Stages 1-8 (`netlify/functions/_personalization/src/lib/networkSafety.ts` 65, `src/openchatcut/captions/segmenter.ts` 13, `cinegen/lib/cloud/funding.ts` 7, ...) and about 90 in `src/features/personalization/**` (develop sync, not Stage 1-8).

## 4. Real watch-page verification (Stage 7)

New harness `tests/browser-harness/heatmaps/watch-real.mjs` (README updated): vite dev server, the real `src/pages/WatchPage.jsx` at `/watch/abcdefgh12`, real preview engine playing a real 10 s webm, real mouse. Only the network layer is mocked with Playwright routes (Supabase RPC `get_published_video`, the media file with byte ranges, `/api/video-events` recorded). Recorded batches go through the real `netlify/functions/video-events.js` into a local Postgres 16 (`mkdb.sh`, now repo-relative), and the owner RPCs are read back. Final run: **25 checks, 25 passed, 0 failed** (6 viewer sessions, 900x500 viewport).
Asserted from the real page: batches carry `heat_click` with normalized x/y equal to the real click point (+-0.005), CTA id, kind (`book_call` from the owner's label wording, `call_now` for `tel:`) and label; a double click in the same 1% cell counted once; the existing `cta_click` / `call_click` still sent; `cta_impression` once per CTA; scroll milestones 25/50/75/100 once each with 100 only after scrolling to the bottom of a page taller than the viewport; `watch_buckets` as ranges; per-session `seq` strictly increasing; no element text / phone number in any body; `?consent=essential` captures without a viewer id; **Do-Not-Track, Global Privacy Control, `?consent=0` and `?consent=off` produce zero requests** (also after click, scroll, play and a hide). Database after the real handler: clicks 30 (= sent), 6 sessions pass the cohort, 6 impressions and 6 clicks per CTA with the right kinds, scroll 100 reached by 6, per-second viewers 6 for seconds 0-6, replays 0.

**Bug found in Stage 7 code and fixed** (`src/lib/editor/publish/heatmapCapture.js`, commit "Heatmap watch buckets: a pause/resume ..."): pausing closed the play-through, so resuming re-counted the second the viewer paused in; every pause produced a false "replay" second in `video_watch_seconds` (first real run: replays `[0,0,0,0,6,0,0]`, all six sessions). Pause/resume at the same spot (forward, within 1.5 s) now continues the run; a seek back still starts a new one. Regression tests added to `heatmapCapture.test.js` (the pause/resume case fails without the fix; the real-replay case guards the other direction). Related suites after all changes (`src/cinegen src/lib/editor/publish src/lib/editor/projectLibrary src/test/heatmap-migration.test.js netlify`): 291 files passed, 2 skipped, 2711 tests passed, 32 skipped, 0 failed. The full `npx vitest run`, `npm run build` and the legacyCards baseline failure were not re-run.

Other findings (pre-existing, not Stage 7):
- `styles/watch.css`: `.watch-player` was flex-shrunk below its content in a short viewport (at 1280x720 the controls bar and the bottom of the picture were clipped; the player clock/scroll depth of Stage 7 sees a page that is never taller than the viewport). Fixed with `flex-shrink: 0` (one-line commit, visually verified at 1280x720: controls visible, page scrolls).
- **Not fixed:** `createPreviewEngine().play()` is `player?.play()`: a Play pressed before the Remotion player ref is bound is silently lost (button shows "Pause", clock stays 0:00). Reproduced 6/6 when clicking within ~1 s of load, 0/3 when waiting 3 s; independent of Stage 7 (same with `?consent=0`). The harness therefore waits for the player before pressing play. Fix idea: remember a pending play in `previewEngine.jsx` and call it from `bind`.
- `/api/video-events` is the client endpoint (netlify redirect to the function); the redirect rule itself was not exercised (the route was intercepted at that URL).

Limits of this verification: the final flush on a real page unload (`pagehide` beacon) cannot be observed through Playwright routing, so hiding is emulated with `visibilitychange(hidden)` (same `final` flush path, beacon returns true); a synthetic wheel stopped working in headless Chromium after clicking a `tel:` link, so the scroll uses `scrollTo` (real scroll events) and `tel:` navigation is cancelled in the page. The Supabase RPC, the media host and the Netlify redirect are mocks; live Supabase/Netlify/Clerk were not touched.

## 5. SQL and Postgres-with-RLS harnesses

- `supabase/tests/run-assertions.sh` now also applies `20261114100000_heatmap_analytics.sql` (which redefines `prune_video_analytics` and `delete_video_analytics`) before `50_assertions.sql`: **ALL ASSERTIONS PASSED** (before and after adding it). `run-heatmap-assertions.sh`: ALL HEATMAP ASSERTIONS PASSED (36 assertions, migration applied twice).
- `tests/browser-harness/projects-analytics/e2e.cjs` (real Postgres 16 with RLS, bridge, seeded ~160 sessions, Chromium, vite on :3100) run on a scratch copy with the new migration applied: **58/58 checks passed**. Setup deviations: scratch dir paths, `executablePath` for the installed Chromium, a small CORS media server for `kitchen.mp4`, HS256 test tokens. `chain.cjs`, `publish.cjs`, `cinegen*.cjs`, `palette.cjs` of that harness were **not run**.

## 6. Browsers

Playwright 1.65.0 is installed but only `/opt/pw-browsers/chromium-1243` (Chromium 153; the default path `chromium-1254` is missing, hence explicit `executablePath`) and `chromium_headless_shell-1243` exist. `firefox-1572` and `webkit-2388` are **not installed**, so nothing could be verified in Firefox or WebKit/Safari (behaviour of `sendBeacon`, `IntersectionObserver`, `Global Privacy Control`, canvas heatmap rendering there is unverified).

## Commits
`dc2f531a5` parity, `a6b711f1e` lint, `a4529b1e2` type fixes, `99a59e0e8` run-assertions, `75896b1d9` heatmap pause/resume fix + tests, `54fb009e7` watch-real harness, `d94ae5352` watch.css, plus this report.
