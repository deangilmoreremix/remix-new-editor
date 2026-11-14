# SmartVideo AI — Stage Status

| Stage | Title | State | Approval | Completed | Commit | Tests | Remaining issues |
|---|---|---|---|---|---|---|---|
| 0 | Application & feature audit | **Complete (audit-only)** | Authorized by the master prompt (Stage 0 only) | 2026-11-13 | see `git log` for the commit titled "Stage 0 audit" | Baseline below | See master plan §5 |
| 1 | Personalization data & visual editing | **Complete and verified** (see limits in the Stage 1 completion section) | Authorized by the user ("continue with the next phase", then "complete all of stage 1") | 2026-11-13 | see `git log` ("Stage 1 completion") | Full suite 766/766 files, 10,988 passed, 0 failed, 61 skipped; typecheck gate 0 errors; eslint src 0 errors; live checks 8/8, 19/19, 31/31; SQL 40/40 | Migration for synced layouts is **not applied** anywhere |
| 2 | Website backgrounds & business assets | **Complete and verified** (limits listed in the Stage 2 section) | Authorized by the user (approval of the roadmap plan, which authorized Stage 2 only) | 2026-11-13 | see `git log` ("Stage 2") | Full suite 770/770 files, 11,114 passed, 0 failed, 61 skipped; typecheck gate 0; eslint src 0 errors; Stage 2 real-chain check 29/29 | Capture bucket is still public-by-URL; see limits |
| 3 | MediaPipe presenter effects | **Complete and verified** (limits listed in the Stage 3 section) | Authorized by the user ("let's only check every 3 phases": Stages 3–5 run back to back, then stop) | 2026-11-13 | see `git log` ("Stage 3") | Stage 3 unit/panel tests 78; personalization suite 191 files, 2,360 passed; typecheck gate 0; live check 53/53 (see below) | Processed footage is stored in the browser only; see limits |
| 4 | Advanced browser audio | **Complete and verified** (limits in the Stage 4 section) | Authorized (3-stage cadence) | 2026-11-13 | see `git log` ("Stage 4") | 71 unit/panel/composition tests; personalization suite 194 files, 2,431 passed; typecheck gate 0; live check 40/40 | Mixdown stored in the browser only; tested on short clips only |
| 5 | Advanced video effects & motion | **Complete and verified** (limits in the Stage 5 section) | Authorized (3-stage cadence) | 2026-11-13 | see `git log` ("Stage 5") | 48 unit/panel/composition tests; personalization suite 197 files, 2,479 passed; typecheck gate 0; live check 40/40 | Transitions beyond the existing website hand-over and the GL effect system were not touched |
| 6 | Captions, text & intelligent editing | **Complete and verified** (limits in the Stage 6 section) | Authorized ("finish all of the task" + approved Stages 6–12 plan) | 2026-11-13 | see `git log` ("Stage 6") | 48 unit/panel/composition tests; live check 36/36 | Transcription accuracy depends on the model; see limits |
| 7 | Thumbnails & personalized GIFs | **Complete and verified** (limits in the Stage 7 section) | Authorized (approved Stages 6–12 plan) | 2026-11-13 | see `git log` ("Stage 7") | 66 unit/panel tests; live check 29/29 | GIFs are not uploaded anywhere yet (Stage 8/9) |
| 8 | Personalized publishing & watch pages | **Complete for recipient identity, links, attribution and revocation; per-recipient video publishing is Stage 10** (see the Stage 8 section) | Authorized (approved Stages 6–12 plan) | 2026-11-13 | see `git log` ("Stage 8") | 21 unit + 16 route + 14 video-events + 7 panel tests; SQL 43/43; full-stack check 9/9 | **Migration `20261115000000` is NOT applied anywhere** |
| 9 | React Email & outreach | **Complete for building, checking, exporting and TEST-sending the email, plus unsubscribe and suppression; sending to a list is NOT built (Stage 10) and no real mail was sent** (see the Stage 9 section) | Authorized (approved Stages 6–12 plan) | 2026-11-13 | see `git log` ("Stage 9") | 51 new unit/route/panel tests; SQL 21/21; real SMTP + SQL check 8/8; 12 mutation checks caught | Migration not applied; no email provider chosen; no real inbox delivery verified. |
| 10 | Bulk personalization & automations | **Complete for CSV import, per-recipient files (thumbnail, GIF, MP4), resumable in-tab batches, package export and an outreach-sequence PLAN; publishing a different rendered video per recipient is NOT built, and nothing runs automatically** (see the Stage 10 section) | Authorized (approved Stages 6–12 plan) | 2026-11-13 | see `git log` ("Stage 10") | 64 new unit/panel tests; real-browser check 29/29; 19 unit mutations + 1 live mutation caught | Per-recipient video publishing needs a storage decision; no scheduler; tab must stay open. |
| 11 | Analytics, notifications & reporting | **Complete for the owner-checked report, results dashboard, PDF/CSV export and opt-in push (sender, routes, worker, panel); no push was delivered to a real browser** (see the Stage 11 section) | Authorized (approved Stages 6–12 plan) | 2026-11-14 | see `git log` ("Stage 11") | ~100 new unit/route/panel tests; SQL assertions; full-stack 8/8; 14 mutations caught | Migration not applied; VAPID keys needed; no real-browser push verified. |
| 12 | Performance, recovery & final validation | **Complete** (recovery, backup, long-clip limit, end-to-end chain and final validation; limits in the Stage 12 section and the final report) | Authorized (approved Stages 6–12 plan) | 2026-11-14 | see `git log` ("Stage 12") | 28 new unit/panel tests; real-browser check 15/15; end-to-end chain 9/9; 13 mutations caught | Real push and real email delivery unverified; migrations unapplied. |

**Review cadence (user instruction, 2026-11-13: "We need to finish all of these stages so let's only check every 3 phases").** Work proceeds through Stages 3, 4 and 5 without stopping between them, then STOPS for review with a combined report. After approval: Stages 6–8, then 9–11, then 12. Every stage still gets its own real tests, commit and entry in this file and in `IMPLEMENTATION_LOG.md`. Anything that needs a decision only the user can make (email provider for Stage 9, VAPID keys for Stage 11, applying migrations, production deploys) is NOT covered by this cadence and will be flagged, not assumed. The queued Personalization Studio prompt is still not authorized.

Scope note: the Recorder is excluded — being completed in another chat.

## Baseline (Stage 0) — commands actually run, 2026-11-13

Environment: Node v22.23.4, npm 10.9.9, Linux. `node_modules` was absent; installed for the baseline only (gitignored; no lockfile written; `package.json` unchanged).

| Command | Result |
|---|---|
| `npm install --no-package-lock --ignore-scripts --no-audit --no-fund` | **Exit 0**, 1510 packages added (~1 min). The six missing `file:packages/*` `@higgsfield/*` directories did **not** block the install. `--ignore-scripts` was used, so postinstall steps (native/binary packages) were not exercised. A `popcorn-js` git dependency produced an integrity-check warning only. |
| `npx vitest run --reporter=dot` (root `vitest.config.js`) | **Exit 1.** 759 test files: **757 passed, 2 failed**. Tests: **10,864 passed, 2 failed, 61 skipped** (10,927). Duration 323 s. |
| `npx tsc --noEmit -p tsconfig.json` | **Exit 2.** 22 errors, all syntax errors (TS1128/TS1109/TS1434/TS1005) in `packages/layout/src/react/Sidebar.tsx` (8), `packages/tokens/src/index.ts` (3) and their copies under `apps/director/frontend/packages/` (8 + 3). No type errors elsewhere were reported, but syntax errors can stop type checking of the affected files. There is no `typecheck` script; this is the closest command. |
| `npx eslint src --ext .js,.jsx,.ts,.tsx` (`NODE_OPTIONS=--max-old-space-size=6144`) | **Exit 0.** 0 errors, 34,652 warnings. |
| `npm run build` | **Not run.** The script runs nested `npm ci` in `apps/*` and `rm -rf dist`, which would modify the tree. |
| Playwright / e2e | **Not run** (needs browser binaries and a running dev server; out of Stage 0 scope). |
| Browser/manual checks of any feature | **Not performed.** |

### The 2 failing tests (pre-existing; no code was changed by Stage 0)
1. `src/cinegen/__tests__/timeline-parity.test.ts` — `components/edit/timeline-editor.tsx differs by at most 220 lines`: received **224** > budget 220. (Parity budget exceeded; the budget file is a guard against drift from vendored CineGen.)
2. `src/features/personalization/apps/motion-director/__tests__/legacyCards.test.ts` — "its textures are served from the legacy namespace and exist": `existsSync('public/motion-studio/legacy-textures/agent-stre…')` is false (file missing from checkout; not investigated further).

Test types: the vitest suite is jsdom-based unit/integration with extensive mocking; none of it proves real browser rendering or real provider integration.

## Remaining issues carried forward
See `docs/SMARTVIDEO_MASTER_ENHANCEMENT_PLAN.md` §5 (broken/incomplete), §7 (architecture limits), §9 (licensing). Items most likely to block later stages: simulated email send, forgeable recipient ids, defective GIF encoder, 2 failing baseline tests, tsc syntax errors in `packages/{layout,tokens}`.


## Stage 1 — Personalization data and visual editing (2026-11-13)

**Status: Partially complete.** Implemented and verified at unit, integration (jsdom, real state) and real-renderer-still level. NOT verified: the live modal driven in a real browser against a real project, an actual MP4 export, and persistence against a live Supabase project.

### What the audit found already existing (reused, not rebuilt)
The Personalization Modal's `OverlayEditor` already had drag, uniform resize, undo/redo, lock, opacity, colour, font, safe-area clamping, timing, image crop focus, position presets, restore-defaults and a before/after preview. Stage 1 therefore **extends** it rather than adding a second canvas editor.

### Implemented
| Feature | Where | Notes |
|---|---|---|
| Rotate | Layer panel "Arrange" → Rotate (slider, number, reset) | `PreviewLayer.rotation`; text/CTA rotate about their own box, images about their square box. Designs and the split-screen preset do not rotate |
| Duplicate | Arrange → Duplicate | Copy sits above the original, offset, never locked/grouped; designs are not duplicable |
| Stack order | Arrange → To back / Back / Forward / To front | Reorders the layer array (the composition stacks by media role, then array position) |
| Group / ungroup | Shift/Ctrl/Cmd-click layers → Group / Ungroup | `PreviewLayer.groupId`; dragging any member moves the whole group; locked members stay put; the group stops together at the frame edge |
| Multi-select drag | Shift-click | Moves the selection |
| Align | Arrange → Align (6) | One layer aligns to the safe area; several align to their bounding box; locked layers are skipped |
| Snapping + guides | While dragging | Frame edges/centre, other layers' edges/centres, optional 5% grid; cyan guide lines; hold Alt to disable |
| Image zoom | Image style controls (existing crop sliders) + `ImageStyle.zoom` | 1–4×, only when the picture fills its shape (`cover`) so the clip hides overflow |
| Presenter/background reposition + zoom | "Presenter / background footage" panel | `settings.sourceTransform` (x, y, zoom) applied to the background video/poster in the shared composition |
| User-defined fields | "Custom fields" panel | `settings.customFields`; `{{key}}` in any text layer; unknown `{{tokens}}` are left untouched |
| Reusable layouts | "Saved layouts" panel | Geometry only (position, size, rotation, opacity, visibility, lock, group, footage transform) — never text/images/URLs. Stored in **this browser's localStorage** |
| Persistence | `normalizeLayer` / `normalizePreviewSettings` | New fields round-trip through the existing save payload and restore; old projects load unchanged |
| Undo/redo | `editPreviewSettings` in the provider | Every new action is one history step via the existing history |

### Defects found and fixed (pre-existing)
1. **`Internals.SequenceManager` crash.** `PersonalizationComposition` rendered `<Internals.SequenceManager.Provider>`, but in the pinned Remotion 4.0.540 `Internals.SequenceManager` is `undefined` (only `SequenceManagerProvider` exists). In a real browser the composition threw `Cannot read properties of undefined (reading 'Provider')`; every jsdom test mocks it, so nothing caught it. It is now used only when the runtime provides it. This also removes 2 pre-existing `tsc` errors.
2. **Text rotation pivot** (found by the real render while building Stage 1): text layers sit in a frame-tall wrapper, so rotating the wrapper swung the text far from its position. Text/CTA are now rotated on their own auto-height element, matching the editor stage.

### Not done / deliberately different
- **React Konva and React Easy Crop were NOT added.** The existing editor already provides drag/resize/crop/stage; a Konva canvas would be a second editing surface that does not use the Remotion layout. Crop is slider-based (focus + zoom), not drag-to-pan inside the image. Say so if you want them anyway.
- No on-canvas rotate handle (rotation is via the panel).
- Resize is uniform (a single size), as before.
- Rotation is not re-clamped to the safe area (the clamp is for the unrotated box).
- Groups are an editing relationship only; each member still renders as its own layer.
- Saved layouts are per-browser, not synced to Supabase.
- "Presenter repositioning" moves/zooms the whole source frame; a separate presenter cut-out is Stage 3 (MediaPipe).
- Not audited/changed: website screenshot, CTA destination and presenter-media fields beyond what the modal already had.

### Test evidence
| Command | Result |
|---|---|
| `npx vitest run` (full) | **Exit 1: 761/763 files, 10,927 passed, 2 failed, 61 skipped.** The 2 failures are the same two as the Stage 0 baseline (`timeline-parity`, `legacyCards`). +63 passing vs baseline |
| New: `guided/__tests__/stage1LayerEditing.test.ts` | 33 pass — pure helpers, normalizers, ops, snapping, layouts (unit) |
| New: `preview/__tests__/stage1Composition.test.tsx` | 11 pass — the shared composition (jsdom; Remotion mocked, style passes through) |
| New: `guided/__tests__/stage1Editor.test.tsx` | 17 pass — editor UI end to end with real state, pointer drags (jsdom; provider mocked) |
| New: `__tests__/stage1ProviderPersistence.test.tsx` | 2 pass — REAL provider: undo/redo and save→JSON→restore |
| `node scripts/stage1-render-check/run.mjs` | **Exit 0, 8/8 checks** — real Remotion web renderer in headless Chromium, assertions on decoded pixels |
| Mutation checks | Breaking rotation/zoom in the composition, the normalizer, or the pivot makes the matching tests fail; restored code passes |
| `eslint` (personalization tree) | 0 errors (style-only warnings, as repo-wide) |
| `tsc` | The root `tsc` still stops at 22 pre-existing syntax errors elsewhere, so it is not a reliable type check. A scoped config over the changed files showed no errors in new/changed code; remaining errors there are unrelated alias/`@types/node` noise |

Real-render results (`renderStillOnWeb`, 1920×1080): rotated text pivots about its own centre (centre within 25 px of the unrotated centre); `Hello {{city}}` renders `Hello Austin`; footage zoom 2× about (25%, 25%) moves the quadrant boundary from x=960→1440 and y=540→810, measured on pixels. Identical inputs produce byte-identical PNGs.

### How to test
- Unit/integration: `npx vitest run src/features/personalization/shared/personalization`.
- Real renderer: `node scripts/stage1-render-check/run.mjs` (needs `npm install` and a Chromium; PNGs land in `scripts/stage1-render-check/out/`, git-ignored).
- In the app (not run by me): open any studio's Personalize modal → Advanced Editing / step 4 overlay editor → select a text layer → Rotate / Duplicate / Group / Align; drag near the frame centre to see snap guides; use "Presenter / background footage", "Custom fields", "Saved layouts". No preview URL exists for this branch.


## Post-Stage-1 repair pass (baseline errors and skipped tests) — 2026-11-13
Requested by the user ("fix the errors and why did we skip 61"). Not a new stage; no feature work.

### Fixed
| Item | Cause | Fix |
|---|---|---|
| `tsc` syntax errors in `packages/layout/src/react/Sidebar.tsx` (and the identical copy under `apps/director/frontend/packages/`) | Corrupted hover handlers: `Object.assign(itemEl.style, structure.item as any) as any).itemHover)` — unbalanced parentheses and an undefined `itemEl` | Hover applies `structure.itemHover` to `e.currentTarget`; leave restores the resting style |
| `tsc` syntax errors in `packages/tokens/src/index.ts` (+ copy) | CSS (`@import ...`) was saved inside a `.ts` file | Valid TS module that `import`s `index.css`, `layout.css`, `themes.css` (its stated purpose) |
| `timeline-parity` test failing (224 > 220) | The Add-video-dialog / drop-onto-track change (99452b82) moved `timeline-editor.tsx` 4 lines past its drift budget | Budget raised to 230 on purpose with a `[remix]` note, as the test itself instructs. **This is a policy call:** it accepts the drift rather than reducing it |
| Root cause of the missing texture | `.gitignore` has `*.jpg`, so `public/motion-studio/legacy-textures/agent-stream.jpg` was never committed | Added a negation so legacy-texture JPGs are tracked once supplied |

### Still failing (needs your input)
- `legacyCards.test.ts > its textures ... exist`: `public/motion-studio/legacy-textures/agent-stream.jpg` is not anywhere in the repo or its git history. A retired Motion Director recipe (`StreamResponse.tsx`) also references it, so that recipe renders a missing image. The original file must be supplied; I did not fabricate one.

### `tsc` — what is true now
- The 22 syntax errors are gone. But the root `tsc -p tsconfig.json` still reports **1,381 `TS6059`** errors (config: `rootDir: ./src` while the project also includes `packages/` and `apps/`), and `tsc` stops at config errors before type-checking, so it has never produced a real type check. It also needs a >4 GB heap (it ran out of memory at the default).
- Overriding `--rootDir .` on the command line (config untouched) gives the real figure: **12,870 type errors**, mostly in vendored `apps/cinegen`, `src/cinegen`, `apps/video-agent-studio` (implicit `any`, unresolved aliases such as `@ohb/*`, missing `@types/node`). This is long-standing and was NOT fixed here.

### Why 61 tests are skipped
They are pre-existing `it.skip` / `describe.skip` / `it.skipIf` markers in 18 files, not something Stage 0/1 added. Un-skipping all of them temporarily (then restoring) showed: **37 fail when enabled**, the rest pass or are conditional (`skipIf` on a missing clone). Reasons:
- ~24 are cinegen "upstream" tests from the desktop (Electron/Mac) app asserting desktop behaviour this web build does not have (`/Users/...` paths, `local-media://`, "native bridge on Mac", RunPod session nodes, Topview provider card).
- 3 `ErrorBoundary` tests (`production-readiness.test.js`) are skipped because they are covered by Playwright E2E (its own comment) and fail under this vitest environment.
- 2 `toImageBlob` tests are documented jsdom limits (jsdom `Blob` vs Node `Response`).
- Others (`providerErrorRecovery`, `catalogBatch3a/3f`, `skills`) have no recorded reason.
Skipped tests were never evidence of passing behaviour. None were un-skipped permanently.


## Stage 1 — completion pass (2026-11-13)
Requested by the user: "complete all of stage 1 and make sure there are no errors". Scope chosen by the user: Stage 1 code + tests; add the on-canvas rotate handle, drag-to-pan crop, react-konva + react-easy-crop and Supabase-synced layouts; verify with a real export, a real-browser editor run and a Supabase check.

### What was added
| Item | Detail |
|---|---|
| Failing test fixed | `legacyCards`: the retired `StreamResponse` recipe drew `agent-stream.jpg`, which was never committed (a `*.jpg` ignore rule). Its backplate is now a CSS gradient and the test no longer requires the file. **This changes that retired recipe's look** (the original photo is not recoverable); supply the original to restore it |
| Type check that works | `tsconfig.stage1.json`, `scripts/typecheck-personalization.mjs`, `npm run typecheck:personalization`: **0 errors in the personalization tree**. It also prints the 98 pre-existing errors in imported vendored/legacy files it ignores. 74 in-tree errors were fixed (lib ES2022, `allowJs`, vite types, a global `IS_REACT_ACT_ENVIRONMENT` declaration, `React.JSX`, ~20 explicit parameter types, 8 test typings) |
| On-canvas rotate / resize handles | `guided/KonvaTransformOverlay.tsx` + `...Impl.tsx` (react-konva `Transformer`): rotate handle (Shift snaps to 15°), uniform corner resize. Lazy-loaded; if Konva fails to load the editor silently keeps the panel controls and the existing handle. The canvas takes pointer events **only while over a handle**, so drag, group-move and snapping are unchanged |
| Drag-to-pan crop + zoom | `guided/ImageCropDialog.tsx` (react-easy-crop) opened by "Crop & zoom…" in the image style controls. `guided/cropMapping.ts` maps the framed area to `cropX / cropY / zoom` exactly as the composition renders them (verified against an independent simulation of the CSS) |
| Synced saved layouts | Migration `20261114000000_personalization_saved_layouts.sql`; route `/api/personalization/layouts` (GET/POST/DELETE, Clerk session, rate limited, geometry-only, re-validated server-side); `savedLayouts.ts` remote adapter and `useSavedLayouts` hook. Browser storage stays the fallback. **Nothing is uploaded unless the user presses Upload** |

### Dependencies and licences (verified from each package's own LICENSE file)
| Package | Version | Licence | Notes |
|---|---|---|---|
| `react-konva` | 19.2.3 | MIT | peer `react ^19.2.0`; installed React is 19.3.1. 19.3.x wants React 19.3 and the repo's range is `^19.2.7`, so 19.2.3 is pinned |
| `konva` | ^10.9.1 | MIT | |
| `react-easy-crop` | ^6.2.5 | MIT | |
`npm install` (no lockfile in this repo) also changed 7 transitive packages. All three libraries are lazy-loaded (dynamic import), and were added to `vite.config.js` `optimizeDeps.include` because the repo's own comments warn that late-discovered dependencies 504 in-flight requests.

### Test and verification evidence (all commands actually run)
| Command | Result |
|---|---|
| `npx vitest run` (full) | **766/766 files, 10,988 passed, 0 failed, 61 skipped** (skipped count unchanged; they are the pre-existing desktop-only/documented skips) |
| `npm run typecheck:personalization` | 0 errors in scope (98 out-of-scope pre-existing errors reported) |
| `eslint src --ext .js,.jsx,.ts,.tsx` | 0 errors (warnings are the repo-wide style warnings) |
| `supabase/tests/run-layouts-assertions.sh` on local **PostgreSQL 16** | **40 assertions, ALL PASSED**: per-user isolation through the RPCs, the RLS policies themselves (re-granting table access in the test), grants (anon/authenticated cannot call or read), name/size/cap-30 limits, identity required |
| Route tests (`netlify/functions/_personalization/tests/layoutsApi.vitest.test.ts`) | 21 pass (session user id only, geometry-only storage, 401/400/413/409/404/429, no DB error leakage) |
| `scripts/stage1-render-check/run.mjs` | exit 0, 8/8: real Remotion web renderer stills, pixel assertions (rotation pivot, `{{field}}`, zoom) |
| `scripts/stage1-render-check/editor-check.mjs` | **19/19** in headless Chromium: the REAL `DemoPersonalizeProvider` + `OverlayEditor` with real mouse input: panel rotate, **Konva rotate handle dragged to 90°**, undo/redo, duplicate, group drag (+snap guide), saved layout, crop dialog (drag + zoom + Apply), save payload -> JSON -> restore |
| `scripts/stage1-render-check/export-check.mjs` | **31/31**: the app's own `exportPersonalizedVideo` produced an **H.264 MP4**; `ffprobe`: 640x360, 60 frames, 2.005 s; decoded frames show the rotated text pivoting within 2.5 px of its centre, the zoom boundaries at x=480 / y=270, and `{{city}}` replaced (checked against a no-field control export) |
| Mutation checks | Deliberately breaking the composition pivot, the normalizer, the crop formula, the RLS select policy, the "geometry only" storage, and adding a silent upload each made the matching tests fail; restored code passes |

### Supabase (read-only inspection through the connected MCP; nothing written)
- Project "VideoRemix Product" (`bzxohkrxcwodllketcpz`). `personalization_saved_projects` exists with RLS enabled. `personalization_saved_layouts` does **not** exist and migration `20261114000000` is **not** in the applied list: **the migration has not been applied to production or to any branch.** A throwaway branch was not created (it needs your approval and may cost).
- **Security finding, not part of Stage 1:** the Supabase advisor reports **117 public tables with Row Level Security disabled**, including `personalization_projects`, `personalization_outputs`, `personalization_profiles`, `user_api_keys`, `provider_settings`, `access_tokens`, and `admin_analytics_events` (71,842 rows). With RLS off, anyone holding the anon key can read or modify them. I did not change anything. Enabling RLS without policies blocks all access, so this needs your decisions on policies. The advisor's remediation link: https://supabase.com/docs/guides/database/postgres/row-level-security

### What is NOT verified (honest limits)
- The new route was exercised with mocked Clerk auth / Supabase RPC and the SQL on a local PostgreSQL 16 (which emulates Supabase roles and `auth.jwt()`); it was **not** called on the deployed Netlify site with a real Clerk session, because the migration is unapplied.
- The editor run used a harness around the real provider and editor (app-shell glue such as the router and social-publish context is stubbed; network calls are stubbed). The full signed-in application shell was not driven.
- The exported video was 640x360, 2 s, an image source with no audio: not a full-size clip with a real video source or soundtrack.
- Konva handle position for multi-line text uses the editor's line-count estimate, so on wrapped text the handle box can differ by a few pixels from the true text box (the stored rotation is unaffected).
- Rotation is not re-clamped to the safe area; designs and the split-screen preset are not rotatable.
- Out of scope and unchanged: 61 skipped tests (37 would fail if enabled), the repo-wide 12,870 type errors, and the 117 RLS-disabled tables above.

### How to test
- Unit/integration: `npx vitest run`.
- Type and lint gates: `npm run typecheck:personalization` and `npm run lint`.
- Real renderer / editor / export (needs `npm install`, ffmpeg and a Chromium; set `CHROMIUM_PATH` if not at `/opt/pw-browsers/chromium`): `node scripts/stage1-render-check/run.mjs`, `.../editor-check.mjs`, `.../export-check.mjs` (screenshots, PNGs and MP4s land in `scripts/stage1-render-check/out/`, git-ignored).
- RLS on a local database (needs a local PostgreSQL 16): `supabase/tests/run-layouts-assertions.sh` (with `PGHOST`/`PGUSER` for a superuser connection).
- In the app: open a Personalize modal -> overlay editor: select a layer and drag the round rotate handle above it (Shift = 15° steps); in an image layer's style controls press "Crop & zoom…" and drag the picture; "Saved layouts" shows whether layouts go to your account or this browser.


## Stage 2 — Website backgrounds and business assets (2026-11-13)
Authorized by the user's approval of the roadmap plan (Stage 2 only).

### What was built (reusing the existing capture service; no second screenshot backend)
| Feature | Where | Notes |
|---|---|---|
| Website capture from the editor | Overlay editor → **Website background** panel (`guided/WebsiteBackgroundPanel.tsx`) | Uses the existing `captureSite` client, `/api/motion-studio/capture` (Clerk sign-in + SmartVideo GO entitlement + SSRF guard + quota) and its job polling. Address is pre-filled from the business's website when the project knows it. Progress, cancel, and plain-language errors (sign-in, plan, quota, refused address, timeout) |
| Full-page / section pictures | Same panel | Choose any captured page, or a **section picture** (crop) instead of the whole page |
| Animated scrolling | `preview/websiteBackground.ts` + `WebsiteBackgroundLayer.tsx` | Scroll start/end (0-100%), easing, timing window in seconds, "scroll to section" when the capture found sections |
| Zoom and pan | Same | Zoom start/end 1-3x about a chosen centre |
| Cursor animation + click effects | Same | Arrow/hand cursor, 4 movement presets, ripple/pulse, add/remove clicks |
| Website-to-presenter hand-over | Same | Fade, slide or cut at the end of the window; the source/presenter video shows again |
| Asset preview and assignment to video roles | Same | The capture's logo, pictures and asset-finder pictures: **Use as Logo / Product image / Service image** (durable http(s) URLs only), with attribution |
| Source attribution | Stored in the project (`websiteBackground.source`) and shown in the panel | "Captured from host on date. The pictures belong to that site's owner: use them only with permission." |
| Reusable website layouts | Saved layouts now include the website **motion** | Motion only: never the URL, title, section names or picture (verified by test and mutation). Applies to another prospect's own website picture |
| Editor stage shows the website | `OverlayEditor` | The stage draws the website's opening frame, so layers are arranged over what will play |
| Persistence | `settings.websiteBackground`, normalized on load | URLs must be durable http(s); numbers clamped; old projects load without it |
| Preview == export | One composition | The shared Remotion composition draws the layer, so the live Player and the exported video are the same pixels |

### Security and quota fixes made on the way
- **SSRF:** the asset finder's private-address check (`_personalizationAssets.js`) was a weaker second list (missed CGNAT 100.64/10, benchmarking, documentation, multicast, reserved ranges and mapped IPv6 such as `::ffff:169.254.169.254`, the cloud-metadata address, when it came back from DNS). It now delegates to the shared guard (`isBlockedIpAddress`). Test: 65 cases (literals, disguised forms, DNS answers, mixed answers), red before the fix and green after, plus a parity check against the shared guard.
- **Capture quota:** the capture route counted in process memory, so every serverless instance had its own allowance. It now counts through the database's `rate_limit_check` (shared by all instances) and falls back to memory if the database is unreachable (never fails open). Verified: refused with 429 before any browser is launched.
- **Capture client extracted:** `captureSite` / `DirectorError` / `post` moved to a small `motion-director/lib/captureClient.ts` (re-exported by `directorClient`, no behaviour change) so the editor does not load the whole Motion Studio just to capture a page.

### Test and verification evidence (all run this session)
| Command | Result |
|---|---|
| `npx vitest run` (full) | **770/770 files, 11,114 passed, 0 failed, 61 skipped** |
| `npm run typecheck:personalization` | 0 errors in scope |
| `eslint src` | 0 errors |
| New unit/integration tests | website motion model 26; panel + helpers + layouts 28; asset-finder SSRF 65; shared limiter + capture-route quota 9 |
| `npx tsx scripts/stage2-website-check/capture.mjs` | The **real capture engine** captured `https://smartvid.app/` (your own production site): title found, 3840x3492 full-page screenshot, a section crop, in ~21 s, through the real storage/response builders |
| `node scripts/stage2-website-check/check.mjs` | **29/29** (real editor + real preview Player + app's own exporter): capture through the real client incl. job polling; controls write the motion; attribution shown; preview fade-in, scroll, cursor at the right place, click ripple (94 px vs 0 before the click), hand-over to the presenter video; **exported H.264 MP4** 640x360, 180 frames, 6.02 s; preview vs export agree (PSNR 30 dB); click ripple present in the export (A/B against the same video without it); **scroll accuracy against the actual captured screenshot: 31-33 dB vs 13-15 dB for a wrong offset** |
| Mutation checks | Removing the layer from the composition fails 10 of 28 checks (restored: all pass); breaking the end-frame hand-over, the click position, the layout no-leak guarantee and the limiter's fail-closed fallback each fails the matching tests |
| Stage 1 live checks (re-run) | render 8/8, editor 19/19, export 31/31 |

### Limits (honest)
- **The real capture ran outside Netlify.** In this sandbox the engine's own network dial is blocked, so a test-only harness (`scripts/stage2-website-check/sandbox-egress.mjs`, used only with `USE_SANDBOX_EGRESS=1`) tunnels that one dial through the sandbox's proxy; TLS verification stayed on and no engine code was changed. The Clerk sign-in, entitlement and background-function path of the production route were **not** exercised end to end (the quota path was, with mocked auth).
- **The captured site was your own** (`smartvid.app`, a single-page app). It returned one page, one section crop, **no logo, no gallery pictures and no layout sections**. So "assign pictures to roles" and "scroll to section" are verified with realistic fake capture data in tests, not with a real site that has them. Please try a business site with a logo and sections.
- **Capture storage is still public-by-URL** (bucket `motion-capture`, unguessable paths). Making it private needs a migration, a production bucket change and signed URLs; not done, needs your decision.
- The editor panel types or pre-fills one URL; it does not yet run a Lead Finder search inline (Lead Finder's resolved website is pre-filled when the project has it).
- Cursor movement is chosen from presets (no free-draw path editor); clicks can be added/removed but their moment is fixed by the preset (50% when added by button).
- One website background per project. Per-recipient backgrounds arrive with bulk personalization (Stage 10).
- Hand-over transitions are fade, slide and cut (no wipe).
- Rotation/zoom limits from Stage 1 apply to the presenter footage; compositing the presenter over the website (bubble/cut-out) is Stage 3.


## Stage 3 — MediaPipe presenter effects (2026-11-13)

**Authorization:** the 3-stage cadence instruction above. **Scope kept:** no Recorder changes; no new database, renderer, player, server or paid API; no migration; nothing deployed.

### What was built
| Capability | Where | Notes |
|---|---|---|
| Presenter model (pure): layout `full` / `bubble` / `pip`, shape `circle` / `rounded` / `rect`, size/position, border/shadow, zoom + pan + mirror, background `keep` / `blur` / `colour` / `picture` / `remove`, validation, presets | `preview/presenter.ts` | One source of truth for the preview, the editor stage and the export. Stored as `settings.presenter` (optional: absent = the old full-frame video). |
| Rendering inside the shared composition | `preview/PresenterLayer.tsx`, `PersonalizationComposition.tsx` | Drawn above the Stage 2 website layer, so a cut-out or bubble presenter stands over the website. |
| Segmentation engines | `src/lib/editor/ml/mediapipeSegmenter.js` (new), existing `remotion/bgRemoval.js` (MODNet) | MediaPipe Image Segmenter (`selfie_segmenter`, Apache-2.0), CPU delegate, ~30 ms/frame. Model file `public/mediapipe/selfie_segmenter.tflite` (249,537 bytes, sha256 `191ac952…6658b`, same hash the sibling app pins); wasm bundled by Vite. Nothing is fetched from a third party at run time for MediaPipe. |
| Bake once, reuse everywhere ("processed footage") | `guided/presenterBake.ts`, `presenterMatteStore.ts`, `preview/presenterMatteRegistry.ts` | Transparent VP9+alpha WebM with the audio kept, cached in IndexedDB under a content key (video URL + engine + settings), LRU-evicted at 400 MB. A render never runs a model. Temporal smoothing + edge hardening + a quality gate (refuses "no person" and "everything is person"). Measures the person's bounds. |
| Honest fallback | `presenterRenderPlan` | A background mode with no usable processed footage (never made, cleared, made from a different video) draws the **untouched** video and the panel says why. It never pretends. |
| Editor | `guided/PresenterPanel.tsx`, `PresenterStageBox.tsx`, `presenterEdit.ts`, `probeVideoAspect.ts` | Presets, layout/shape/size/position/ratio/roundness, border/shadow, zoom/centre/mirror, **Frame head and shoulders** (uses the measured person), background modes, engine choice, Process / Cancel / progress / failure messages, drag or arrow-key the box on the stage (one drag = one undo step). |

### Pre-existing defects found and fixed on the way
* `@remotion/media`'s `<Video>` takes **`objectFit` as a prop**; the composition passed it as CSS, which is ignored, so a portrait clip in a landscape frame was letterboxed instead of covered (the Stage 1 "source transform" also depended on it). Fixed for the existing full-frame path as well. **Behaviour change:** footage whose aspect differs from the frame now covers the frame (cropping) instead of letterboxing; same-aspect footage is unchanged.
* Remotion's web renderer does not draw a zero-blur spread/inset `box-shadow` (measured in Stage 5); the presenter border is a real `border`. (A blurred box-shadow, used for the bubble's shadow, is drawn.)

### Verification actually run
* **Unit + panel tests:** 53 (model, geometry, plan, mask maths, framing property tests, cache keys, store eviction/restore, bake pipeline with fake engine: reuse, force, quality gates, engine/encoder failure, cancel, smoothing) + 25 (panel, every failure kind, cancel, reuse, probing, stage box pointer + keyboard). Five deliberate mutations (unmuted blur matte, stale matte accepted, box not clamped, media gap, gate disabled) were each caught, then restored.
* **Personalization suite:** 191 files, 2,360 passed, 10 skipped (pre-existing). **Typecheck gate:** 0 errors in scope. **ESLint:** 0 errors on the new files.
* **Real-browser check (`scripts/stage3-presenter-check/check.mjs`, 53/53):** real MediaPipe bake of a real person clip (122 frames in ~3.5 s, alpha WebM with audio), reuse in 4 ms vs 3.6 s, restore from real IndexedDB, then real exports decoded with ffmpeg: silhouette IoU against the matte 0.91–0.95; person pixels match the source frame (mean abs diff ≈ 10/255); chosen background colour exact in 100% of background pixels; the website shows through behind a cut-out presenter in 100% of background pixels; blur softens the room to <25% of source edge energy with brightness preserved and the person sharp; the bubble is clipped to a circle, the ring and position match `presenterRect` within 2 px; the matte is in sync with the timeline; audio is **not doubled or dropped** (same level as the no-presenter export in every mode) and aligned within 1 ms; the real editor panel → process → frame → mouse-drag flow; the real preview Player frame vs the exported frame for the same settings (mean abs diff 3.1/255, presenter centroid identical).
* **MODNet** on a head-and-shoulders crop agrees with MediaPipe (IoU 0.99, 36 frames in 50 s on CPU/WASM).

### Limits and open items (not hidden)
* **Processed footage lives in the browser that made it.** Another device, cleared site data or a different browser has none: the presenter then shows the original video and says so. Nothing uploads it (no Supabase storage was added). Per-recipient batch processing is Stage 10.
* **MODNet is a portrait matting model and fails on full-body footage** (IoU 0.45 vs MediaPipe on the sample, holes in the torso); the panel labels it "head-and-shoulders only". MediaPipe is the default. MODNet takes ~1.4 s/frame on CPU/WASM here (WebGPU browsers are faster; not measured).
* MediaPipe edges are soft/slightly haloed at feet and hands (visible in the sample); there is no hair-level matting. Check the preview before exporting.
* Only the SIMD MediaPipe wasm is bundled; a browser without WebAssembly SIMD gets a clear error from the bake.
* Blur is the original blurred under the sharp person (no inpainted background plate); a faint colour bleed of the person's clothes into the blur is possible on close inspection (not visible in the 4× crop checked).
* Presenter geometry is **not** part of the Stage 1 saved layouts (presets cover it); an on-canvas corner-resize handle for the box was not built (size slider only).
* The sample clip has no soundtrack: audio checks used a synthetic soundtrack muxed into a copy. The exporter's own loudness on the pre-existing no-presenter path measured ×1.39 of the source file (not introduced here, not investigated).
* Real-browser checks ran in headless Chromium with software rendering; other browsers (Safari/Firefox) were not run.
* Production `vite build` result: see the Stage 3 entry in `IMPLEMENTATION_LOG.md`.


## Stage 4 — Advanced browser audio (2026-11-13)

**Authorization:** the 3-stage cadence. **Scope kept:** no new service, worker server, database or paid API; no Recorder work; nothing deployed or migrated.

### What was built
| Capability | Where | Notes |
|---|---|---|
| Pure DSP (no Web Audio needed): RBJ biquads (shelves, peak, high/low-pass), **ITU-R BS.1770-4 loudness** (K-weighting, 400 ms/75 % blocks, absolute and relative gates), voice-activity **ducking** (depth, attack, release, hold), raised-cosine fades, **look-ahead peak limiter**, beat snapping | `preview/audioDsp.ts` | The same code produces the export's audio in the browser and is unit-tested with numbers. The app's older `loudness.ts` is a documented approximation; this module is the real meter. |
| Mix model: voice (mute, level, rumble filter + 3-band tone with presets, loudness normalise), music (level, fades, loop with 5 ms loop-point dips, start offset, normalise, ducking), master (target LUFS, peak ceiling); validation; content key; "which audio plays" plan | `preview/audioMix.ts` | Stored as `settings.audioMix`. Absent = sources play as before. |
| Mixdown: decode (Web Audio), render stereo 48 kHz, 16-bit WAV, cache in IndexedDB under the key, reuse when nothing changed, measured report (voice/music/final LUFS, peak, ducking depth, notes) | `guided/audioMixdown.ts` | One file is played by preview and export, so they cannot disagree. |
| Composition: with a **current** mixdown it plays only that and mutes every source (full-frame video and presenter layers); stale / missing / disabled → the sources play and the panel says why | `PersonalizationComposition.tsx`, `PresenterLayer.tsx` | Re-renders when the mixdown becomes available after a reload. |
| Exporter hook: before rendering frames, a current mixdown is guaranteed (re-rendered if never applied or stale) | `webExport.ts` → `prepareAudioForExport` | An export can never silently skip the mix. |
| Panel: all controls above, **Measure my audio** (loudness, quiet gaps, tempo via the existing silence/beat analysers), "start the fade-out on a beat", Apply / Apply again / Cancel, pending / stale / active status, report | `guided/AudioMixPanel.tsx`, `audioAnalysis.ts` | |

### Defect found and fixed by the tests
* The first limiter version counted missing history at the start of the file as unity gain, so the first ~5 ms could exceed the ceiling (hot noise measured 2.8 against a 0.89 ceiling). Fixed; a test now pins it (mutation-checked).

### Verification actually run
* **71 tests:** DSP against published references (K-weighting coefficients equal the standard 48 kHz set; a 997 Hz stereo sine at -23 dBFS reads -23.0 LUFS; +10 dB gain reads +10 LU; gating), filter responses vs analytic response vs filtering a real sine, limiter ceiling on hostile input, ducking depth/attack/release/hold, fades, `renderMix` end to end (loudness target and ceiling hit, ducking depth isolated from the voice, EQ and gain exact, loops/offset/silence), WAV encoder, model validation and key sensitivity, plan rules, composition muting in every presenter mode, baking/reuse/failure, exporter hook, panel flows. Six mutations (meter without K-weighting, ducking the wrong way, stale mixdown accepted, video not muted, export hook skipped, the limiter-start bug) were each caught, then restored.
* **Live check 40/40** (`scripts/stage4-audio-check/check.mjs`): real browser decode of an mp4 and an mp3; app loudness equals ffmpeg's EBU R128 on both sources; tempo 119.8 BPM found; the mixdown reads -16.0 LUFS in the app and in ffmpeg; second bake reused in 1 ms vs 122 ms; **exports measured by ffmpeg**: -16 target → -16.0 LUFS, -23 → -23.1, a stale saved mixdown re-rendered to the new -20 target (-20.1); exported audio sample-aligned with the saved mix (lag 0.00 ms), level within 0.15 dB, correlation 0.96 (noise voice) / 0.98+ (tonal music) after AAC; ducking 12 dB ±1.5 measured on the music's own tone, recovered in the pause, ducked again in the next phrase; EQ: rumble filter ≥ 20 dB, +6 dB presence measures +6.0 dB, low band untouched; fades silent at both ends and -6 dB halfway; peak ceiling guaranteed on the mixdown (-3.0 dBFS); everything muted exports silence; the real editor panel (measure → apply → Player switches to the mixdown → change a setting → Player falls back and the panel says stale → apply again → export hits the target).

### Limits and open items (not hidden)
* **Peak ceiling is a SAMPLE-peak ceiling on the mixdown.** The exported AAC file can exceed it: observed 0.1–2.4 dB across runs on a very hot mix (true-peak limiting was not built). Keep the ceiling at -1 dB or lower; the panel says so.
* **Processed on short clips only** (5–8 s fixtures). Decoded audio is held as Float32 in memory (stereo 48 kHz ≈ 23 MB per minute per source), so a long video will use hundreds of MB while rendering; this was not measured and there is no chunked/streaming mixer.
* The mixdown lives in this browser's IndexedDB (shared 400 MB budget with presenter footage). On another device it is re-rendered on export; the preview shows the plain sources until re-applied.
* "Voice" is only the source video's own audio. No voice-over recording (Recorder is out of scope), no second music track, no per-clip volume keyframes/automation, no compressor/de-noiser/de-esser; EQ is a rumble filter plus three fixed bands, not a full parametric EQ.
* Quiet-gap and tempo analysis reuse the existing conservative analysers: no gaps are reported when the voice is quieter than -45 dBFS, tempo works for steady 60–180 BPM music. They are informational: nothing is cut automatically.
* Audible playback in the Player was not listened to or recorded (headless); the check proves which audio the Player is configured to play and measures the exported file.
* The exporter's own gain on the pre-existing mono path measured ×1.39 (√2) in Stage 3; with a stereo mixdown the exported loudness matched the target within 0.1 LU, so the mix is not affected. The cause of the mono behaviour was not investigated.
* Output is 16-bit WAV without dither; the WAV is an internal intermediate (the export encodes AAC).


## Stage 5 — Advanced video effects and motion (2026-11-13)

**Authorization:** the 3-stage cadence. **Scope kept:** no new dependency, renderer, player or service; nothing deployed or migrated.

### What was built
| Capability | Where | Notes |
|---|---|---|
| **Footage look**: brightness, contrast, colour strength, hue, warm/cool, sepia, black-and-white, soften, vignette; 7 presets | `preview/videoEffects.ts`, `preview/FootageFrame.tsx` | CSS filter functions + a `multiply` overlay for warm/cool + a radial-gradient vignette. Applied to the full-frame video and to the presenter's picture. |
| **Camera motion**: zoom and drift across the clip (push-in, pull-out, drift, punch-in), linear or smooth | same | A transform of the footage about the frame centre. |
| **Fades to black** (in/out, picture only) | same + composition | The sound is faded in the Audio mix. |
| **Text effects**: shadow, glow, outline | `preview/layerEffects.ts` | `text-shadow` / `-webkit-text-stroke`, sizes follow the font size. |
| **Exit animations** (fade, slide up/down, shrink) and **3 new entrances** (blur in, zoom in, bounce) | `layerEffects.ts`, composition, `presets.ts` | The exit plays over the last N frames before the layer's end frame; a layer with no end frame never exits (the panel says so). |
| Panels: *Footage look and motion*, *Text effects and exit* | `guided/FootageEffectsPanel.tsx`, `LayerEffectsPanel.tsx`, `effectsEdit.ts` | Pure, validated edits; one undo step each. |

### How it was made trustworthy
* **Measured first, then designed.** A spike exported a grid of CSS effects through the web renderer and read the pixels. **Drawn:** CSS `filter` functions (brightness, saturate, hue-rotate, sepia, blur, drop-shadow), `mix-blend-mode: multiply`, radial gradients, text-shadow, text stroke, blurred box-shadow. **Not drawn:** SVG `filter: url(#id)` (so no SVG colour matrices) and a zero-blur spread/inset box-shadow. Only the first group is used.
* **The colour model is the browser's own maths** (`predictLookRgb`), and the live check compares it with exported pixels.

### Defects found by the tests/checks and fixed
* sepia/grayscale amounts were passed inverted in the predictor (caught by a unit test against values measured in the browser); a negative-zero in the bounce entrance; the Stage 3 inset ring (earlier). **Correction to an earlier claim in this stage:** I first concluded "box-shadow is not drawn" from a spread ring; a follow-up measurement showed *blurred* box-shadows are drawn, so the presenter's shadow stays a box-shadow and only zero-blur spread/inset shadows are avoided. A live mutation (box-shadow ↔ drop-shadow) did not change the shadow check, which is expected for that reason.

### Verification actually run
* **48 tests** (26 pure: validation, CSS strings, colour maths against browser-measured values, motion endpoints/easing/cover guarantee, fades, exits, entrances, edits; 12 composition: nothing changes with no effect, filter/overlays/transform/fade cover, presenter integration incl. removed background, text effects, exit window, entrances, original animations unchanged; 10 panel). Six mutations (sepia args, fade end, exit window, overlays on transparency, composition ignoring the look, shadow form) were each caught, then restored.
* **Live check 40/40** (`scripts/stage5-effects-check/check.mjs`): 24 pixels across 6 presets and 7 single controls match the model within 3/255; vignette centre untouched / corner dark; blur turns a hard edge into a ramp; zoom 1→1.5 and drift put the picture edge where the maths says (±3 px) at frames 0/14/29; fades reach black at both ends and half-brightness halfway; glow/outline/shadow each measured against the same text without them and the glyph unchanged; fade exit gone at its end frame, slide-up exit 14 px as modelled, zoom-in ×1.2 settling, bounce settles, blur-in sharpens, the original fade entrance unchanged; the bubble shadow is drawn; real editor panel → Player → export agree (mean abs diff < 10) and the fade-out reaches black.
* **Production build** of the tree at the end of Stage 4 completed (`vite build`, 3 m 25 s; the MediaPipe wasm, loader and model are emitted). The build of the final Stage 5 code tree also completed (3 m 11 s).

### Limits and open items (not hidden)
* **Not used:** the existing OpenChatCut GL effect system / `@remotion/effects` (WebGL shaders, LUTs, GL transitions). They are a different rendering path that was not verified in the web renderer; Stage 5 deliberately used only effects measured in a real export. No 3D LUTs, grain, sharpening, chromatic aberration, glitch or speed ramps.
* **Transitions** beyond the existing website hand-over (fade/slide/cut) were not added.
* Warm/cool and vignette are **not drawn when the presenter's background is removed** (a multiply overlay would tint the transparent area); the panel says so. The CSS-filter controls still apply there.
* Looks apply to the **source footage and the presenter**, not to the website screenshot, pictures or text. Camera motion moves the footage inside the frame; large drift needs a matching zoom (the presets keep the frame covered; hand-set drift can reveal an edge).
* Fades are **picture only**. Exits need the layer to have an end frame. Text effects are for text layers; picture layers keep their existing styles.
* The H.264 export shifts nominal colours slightly (a flat (200,50,50) clip decodes as (212,62,49) in the exporter); this is pre-existing and affects looks and plain exports alike.
* Headless Chromium with software rendering only; other browsers not run. Preview of heavy blur on long clips was not timed.


## Checkpoint 1 — Stages 3, 4, 5 (verified together on the final tree, 2026-11-13)
| Check | Result |
|---|---|
| Full vitest (`npx vitest run`) | 778 files, **11,313 passed, 0 failed**, 61 skipped (unchanged, pre-existing; see the repair-pass notes) |
| New tests in this checkpoint | 78 (Stage 3) + 71 (Stage 4) + 48 (Stage 5) = 197, plus 17 deliberate mutations each caught and restored |
| `npm run typecheck:personalization` | 0 errors in scope (98 pre-existing out-of-scope, unchanged) |
| `eslint src --quiet` | exit 0 (0 errors) |
| `vite build` (final code tree) | succeeded, 3 m 11 s; MediaPipe wasm + loader + model emitted |
| Live check Stage 3 / 4 / 5 | 53/53, 40/40, 40/40 (re-run on the final tree after all three stages) |
| Not run | other browsers, real Clerk/Supabase paths, any deployment, any migration |

**Awaiting the user (unchanged from earlier + new):** apply the layouts migration? private capture bucket? 117 RLS-disabled tables? real business site for a fuller capture test? email provider (needed before Stage 9)? Recorder status (needed before Stage 10 uses it)? Next after approval: Stages 6, 7, 8 (then stop again).


## Stage 6 — Captions and intelligent editing (2026-11-13)

**Authorization:** the user's "lets continue and finish all of the task" and the approved Stages 6–12 plan (checkpoint reports after 6–8, 9–11, 12).

### What was built
| Capability | Where | Notes |
|---|---|---|
| Captions model: validated cues, 5 presets, word-highlight (none / spoken word / fill-as-spoken), position, size (% of frame height), colours | `preview/captions.ts`, `settings.captions` | Times are ms from the start of the video. |
| Drawn by the shared composition | `preview/CaptionsLayer.tsx` | Same words, moments and colours in the Player and the export. Subtitle text is rendered as text, never markup. |
| SRT / VTT import and export | `captions.ts` (`parseCaptionFile`, `cuesToSrt/Vtt`) | Empty, binary, oversized and malformed files are refused with a plain message. |
| Real transcription | existing Whisper worker (`lib/editor/remotion/transcribe.js`), `CaptionsPanel` | Default model is the app's "Accurate" (whisper-base). Nothing is invented; "no speech" produces no captions. |
| Cue editing + quality checks | `CaptionsPanel`, `captionProblems` | Edit text/times, add, split, merge, delete, shift all; warnings for overlaps, too-fast reading (>20 chars/s), very long lines, <0.3 s, past the end. |
| Scene-change detection + filmstrip | `captions.ts` (`detectCuts`), `guided/videoProbe.ts` (`scanScenes`) | Frame differences on a 64×36 grid at 5 fps, adaptive threshold, minimum scene length; JPEG thumbnail per scene; clicking a scene starts a caption there. |
| Video format check | `videoProbe.ts` (`probeVideo`), `classifyVideoCodec` | Reads codec, size, duration and whether THIS browser can decode it; H.264/VP8/VP9 ok, AV1/HEVC warn, undecodable = bad. |

### Defects found by the checks and fixed
* **The library's page grouping spanned silences** (`createTikTokStyleCaptions` joined "world" and "Next" across a 1.6 s pause), which would keep a caption on screen through a pause. Replaced with pause-aware grouping (a gap of 700 ms always breaks the page; pages are capped at 8 words / 42 characters).
* **`-webkit-text-stroke` made small captions read as dark text** (the centred stroke eats thin white fill). The outline is now a ring of text-shadows.
* **`normalizePreviewSettings` replaces an empty layer list with the layout's default text layers**, so a project with `layers: []` still draws text (affects test harnesses, not users who delete layers in the editor, which keeps one layer hidden). Noted, not changed.
* **whisper-tiny hallucinated** ("Welcome back to my new video") on clean synthesized speech while whisper-base transcribed it almost perfectly; the check and the app use base.

### Verification actually run
* **48 tests** (27 model: validation, SRT/VTT incl. hostile input and round trips, paging/pauses/limits, highlight modes, layout, editing, problems, Whisper mapping, scene cuts incl. static/fade/flash, codec classes; 9 composition; 12 panel). Six mutations (no pause break, highlight modes swapped, `enabled` ignored, size not tied to height, stroke restored, empty import accepted) were each caught.
* **Live check 36/36** (`scripts/stage6-captions-check/check.mjs`): SRT/VTT lossless round trip; four bad files refused; **captions measured in the exported pixels** appear exactly while their page is up (49 sampled times); yellow highlight moves left→right; top/middle/bottom in their own thirds; 1280×720 is 2.0× the width of 640×360; Classic box drawn; markup shown literally; captions off draws nothing; **real Whisper (base) on real synthesized speech**: transcript "Welcome to Acme Roofing. We fix leaks fast. Call us today for a freak world." (one mis-hearing: "free quote"), word spans cover real speech, first word within 0.6 s of the first sound, captions in the export line up with the speech; scene scan finds cuts at 2 s and 4 s (±0.3 s) with a JPEG per scene and **no false cuts** on a static clip, a 4 s cross-fade and continuous motion; codec probe reads H.264/VP9 and flags HEVC (this Chromium cannot decode it); the real editor imports an SRT, edits a cue, the Player shows it, the export matches the Player, and "Download SRT" returns the edited file.

### Limits and open items (not hidden)
* **Transcription is only as good as the model**: base is ~80 MB and mishears; whisper-tiny hallucinated on the same audio. The panel tells the customer to check the words. Tested on one 6-second synthesized English clip, not on real human speech, accents, noise or other languages.
* Transcription runs on CPU/WASM here (8 s for 6 s of speech with the base model); long videos were not timed. Whisper runs in the user's browser; audio is not uploaded.
* Fonts: captions use the composition's bundled font stack, not per-caption fonts. No per-word custom styling, animation presets (pop/bounce) or emoji handling; no speaker labels; no translation.
* Scene detection is tuned for hard cuts at 5 fps; it can miss a cut between two near-identical shots and cannot see dissolves/wipes (it deliberately ignores cross-fades). It was tested on synthetic clips.
* Codec check reads the container's first video track only; it reports whether THIS browser can decode, not whether other viewers can.
* SRT import keeps text and times only (no styling tags, positions or multi-line layout).


## Stage 7 — Thumbnails and personalized GIFs (2026-11-13)

**Authorization:** the approved Stages 6–12 plan.

### The defective encoder (Stage 0 finding) — replaced
`src/lib/gifEncoder.js` drew each frame **before its image had loaded** (blank frames), indexed **every frame against the first frame's palette** (wrong colours from frame 2 on), sent any colour beyond the 256th to index 0, used string dictionary keys, and spread whole frames into `Array.push` (stack overflow at real sizes). It now delegates to a new codec and is `async` (its one caller, the thumbnail studio, now `await`s it).

### What was built
| Capability | Where | Notes |
|---|---|---|
| GIF89a **encoder**: median-cut palette over ALL frames; exact colours when ≤ 256; optional Floyd–Steinberg dithering; integer-keyed LZW; each frame reduced to its changed rectangle; identical frames merged into one longer delay; loop on/off; 20 ms delay floor; limits (4096 px, 300 frames) with plain errors | `gif/gifCodec.ts` | Pure. |
| GIF **decoder** (independent of the encoder; validated against a GIF written by ffmpeg) | same | Used by tests; bounded loops, errors instead of hangs on corrupt input. |
| Thumbnail: **automatic best-frame choice** (candidates spread over the video, skipping fades and the ends; each scored for detail, contrast and exposure at 192 px; only the winner is rendered full size), manual frame, play button, JPEG/PNG | `preview/stills.ts`, `guided/renderStills.ts` | The scoring parts are returned and explained in the panel. |
| GIF from the **real composition** (recipient name, website, presenter, captions, effects) frame by frame through Remotion's web renderer; plan clipped to the video; size advice for email | same | Nothing is uploaded. |
| Panel: settings, create, preview, size/email advice, download JPG/GIF, cancel, every error | `guided/ThumbnailGifPanel.tsx`, `stillsEdit.ts` | `settings.thumbnail`, `settings.gif`. |

### Defects found by the tests/checks and fixed
* The decoder looped forever on corrupt data (a mutation of the LZW encoder hung the test run); loops are now bounded and truncated/corrupt files throw.
* My first GIF-plan maths ignored that the video can end before the chosen length (panel said 24 frames when only 9 existed); `gifPlan` now reports `truncated`.
* A first live check compared the GIF with an ffmpeg-made fixture whose colours Chromium decodes differently (BT.601 vs 709, up to 33/255 off); the fixture is now tagged BT.709.

### Verification actually run
* **66 tests** (14+1 codec incl. the ffmpeg reference GIF and every truncation point; 20 stills; 12 panel; 3 legacy wrapper; others). Mutations caught: palette from the first frame only (the old bug), LZW code size one late, frame merging off, exposure ignored, first frame as a candidate, loop flag ignored.
* **Live check 29/29** (`scripts/stage7-stills-check/check.mjs`): 24-frame 320×180 GIF made from the real composition in ~1 s and 23 KB; ffmpeg reads it (GIF, right size, one frame per planned frame); Chromium decodes it; **every frame's colour matches the source video at that moment (≤ 14/255)**; the personalized headline is in all frames; a different recipient name changes only the text; identical inputs give identical bytes; dither/loop flags; the automatic thumbnail avoids the black first second; the JPEG is real and the right size; a manual frame shows the video's own picture; the play button is drawn in the middle only; PNG works; the **legacy encoder now yields correct red/green/blue frames**; the editor's Create/Download flows.

### Limits and open items (not hidden)
* GIF is 256 colours: photographic video bands without dithering and costs more with it. Typical 3 s / 8 fps / 480 px GIFs of flat or lightly animated content are small (tens to hundreds of KB); busy footage can exceed email limits (the panel warns at 1 MB and 3 MB). No lossy GIF optimisation (gifsicle-style) was added.
* Some email apps (e.g. Outlook on Windows) show only the first GIF frame; the panel says so. Mail-client rendering was not tested.
* The play button is drawn onto the thumbnail pixels; it is not a clickable overlay (the email/watch page adds the link, Stages 8–9).
* Thumbnails/GIFs are made in the browser that edits the project and downloaded; they are not stored per recipient or uploaded yet (Stages 8–10).
* The best-frame score is a heuristic (detail, contrast, exposure); it does not detect faces or closed eyes.
* Rendering uses `renderStillOnWeb` per frame; very long GIFs (100 frames) take proportionally longer (≈ 40 ms per frame at 320 px here); not timed on slow machines.


## Stage 8 — Recipient tokens, personal links, attribution (2026-11-13)

**Authorization:** the approved Stages 6–12 plan. **The migration is written and tested on a throwaway local Postgres only; it is NOT applied to any Supabase project or branch.**

### The security defect (Stage 0 finding) — closed
Personalized links used `?c=<contactId>`, checked only by a regex and passed unauthenticated to the analytics function, so **anyone could attribute views, clicks and leads to any contact id**, and a contact was never tied to the video's owner. Now a recipient is identified ONLY by a **server-issued token** (24 random bytes, 192 bits, 32 URL-safe characters). The database stores only its **SHA-256 hash**.

### What was built
| Piece | Where | Notes |
|---|---|---|
| Token / hash / label planning / URL / CSV helpers (pure, isomorphic) | `publish/recipientToken.ts` | CSV neutralises spreadsheet formulas. |
| Table `recipient_links` + RPCs `issue`, `list`, `revoke`, `resolve` | `supabase/migrations/20261115000000_recipient_links.sql` | RLS own-row (Clerk sub); RPCs security-definer, pinned search_path, **service_role only**; `anon`/`authenticated` have no access at all; unique hash; one live link per (video, name); ≤200 per call, ≤5000 live per video; expiry ≤ 2 years; cascade on video delete. |
| Owner API | `netlify/functions/_personalization/app/api/personalization/recipient-links/route.ts` (registered in `personalization-api.mts`) | GET list (with views/plays/CTA clicks/leads), POST issue, DELETE revoke. Token made here, returned **once** (`Cache-Control: no-store`), never stored. User comes from the verified Clerk session, never the request. 404 for "missing" and "not yours". |
| Visitor path | `netlify/functions/video-events.js` | `recipient` token is hashed and resolved **for this video**; the client-supplied `contact` is **ignored**; unknown/revoked/expired/other-video tokens attribute nothing (the view is still recorded); an extra per-IP limit on resolution. |
| Client | `src/lib/editor/publish/analyticsClient.js`, `src/pages/WatchPage.jsx`, `publish/recipientLinksClient.ts` | The watch page sends `?r=` (validated shape) and no longer sends a contact id. |
| Panel | `guided/RecipientLinksPanel.tsx` | Paste a published video address, list names, optional expiry, make links (shown once with Copy and CSV), see per-recipient counts and status, revoke. |

Counts are **derived from the existing analytics tables** (contact_id = link id), so they are idempotent: a retried batch does not double count.

### Verification actually run
* **SQL assertions 43/43** on a throwaway local Postgres (shim + the real rate limiter, publishing and analytics migrations + this one): ownership, "missing vs not yours" indistinguishable, hash-only storage, resolve rules (other video, made-up, malformed, plain text instead of hash), attribution through the REAL `ingest_video_events` with idempotent retries, revoke/expiry, anon/authenticated denied everything, cascade.
* **Full-stack check 9/9** (real route handlers + real `video-events` handler + real SQL): issue → only hashes stored; attribution and exact counts; retry safe; **forged `?c=` (including a real link id) attributes nothing**; made-up/truncated/plain-hash/other-video tokens attribute nothing and do not break the view; another user cannot list, revoke or issue; revoke is immediate and history stays; expiry; duplicates/limits/bad input.
* **Unit:** 21 token/client, 16 route (auth, validation, hash-only to the DB, user from session, error mapping with no leaks, rate limit), 14 video-events (token resolution, malformed tokens, forged contact, resolver failure, extra limit), 7 panel; watch page sends the token and nothing else. Six mutations (trust `contact` again, resolve ignoring the video, ignoring revocation, issue without ownership, plain token stored, client sending identity again) were each caught — three of them only by the full-stack check.

### Limits and open items (not hidden)
* **Not applied anywhere.** It needs your decision (ideally a Supabase branch first). The route is registered but returns an error until the table exists; the panel then says "not available on this server yet".
* **Not done in this stage (per the plan, Stage 10):** publishing a *different personalized video per recipient* (rendering, uploading and creating a published video per recipient). Today one published video can be shared with many unguessable links and each recipient is tracked separately; the video content itself is the same for all. Lead capture (`lead-capture` Supabase function / `video_leads`) was **not** changed; leads are attributed through the analytics event `lead_submit`.
* **The token is in the URL**, so it can appear in browser history, server logs and (if the page links out) the Referer header. Mitigations: 192 random bits, per-link revoke and expiry, hash-only storage. Not done: `Referrer-Policy: no-referrer` on the watch page and stripping the token from the address bar after load (would break reload); both are cheap follow-ups.
* A link's address cannot be re-displayed (only the hash exists): lose it → revoke and re-issue. Anyone holding a link can open the video (that is what a link is); the panel says so.
* The legacy `?c=` personalization values in a link are still read for page content (what the viewer sees themselves), but identity for analytics comes only from `?r=`.
* Rate limiting of the Netlify routes uses the existing per-instance memory limiter for the owner API; the public resolver uses the shared database limiter.


## Stage 9 — React Email and outreach (2026-11-13)

**Authorization:** the approved Stages 6–12 plan. **Nothing was sent to a real address and no provider account was used.** The migration is tested on a throwaway local Postgres only; it is NOT applied anywhere. The Kit and MailerLite connectors in this session were not touched.

### What was built
| Piece | Where | Notes |
|---|---|---|
| Email model, merge fields, checks, plain text | `email/emailModel.ts` | Merge values are substituted as **text**; unsafe URLs are dropped; checks **block** on: no subject, no text, no valid sender address/name, no postal address, no unsubscribe link, hero without alt text; they **warn** on spammy wording, long subjects, missing preview line, unfilled `{{fields}}`, no link to the video. |
| React Email template + renderer | `email/OutreachEmailTemplate.tsx`, `email/renderEmail.ts` | Table-based, inline-styled HTML; the personalized GIF is linked to the video page; footer has sender, postal address and unsubscribe. `htmlProblems` scans the *rendered* HTML (script, handlers, `javascript:`/`data:` URLs, iframes/forms, images without alt, non-http links); Gmail's ~102 KB clipping size is warned about. |
| `.eml` export | `email/eml.ts` | `multipart/alternative`, base64 parts, RFC 2047 subjects, header-injection characters removed. |
| Unsubscribe tokens, headers, recipient planning | `email/unsubscribe.ts` | HMAC-SHA256 signed token carrying owner + **hash** of the address (never the address); constant-time compare; 730-day max age; RFC 2369/8058 `List-Unsubscribe` + one-click headers; `planRecipients` separates invalid / duplicate / suppressed. |
| Suppression list | `supabase/migrations/20261116000000_email_suppressions.sql` | Per sender, hash only, RLS own-row, RPCs `add / check / list / remove` for `service_role` only. |
| Public unsubscribe endpoint | `netlify/functions/outreach-unsubscribe.js` (+ redirect in `netlify.toml`) | **GET only shows a confirmation page** (link scanners fetch links); POST / RFC 8058 one-click records the suppression after the signature verifies. Fails closed (503) without `OUTREACH_UNSUBSCRIBE_SECRET` (>= 16 chars), rate limited, strict CSP and `no-referrer`. |
| Test-send route | `netlify/functions/_personalization/app/api/personalization/outreach/route.ts` (registered in `personalization-api.mts`) | Signed-in only; **disabled (503) unless** `OUTREACH_SEND_ENABLED=true`, `OUTREACH_SMTP_URL`, `OUTREACH_FROM_ADDRESS`, `OUTREACH_UNSUBSCRIBE_SECRET` are set; **only addresses on `OUTREACH_TEST_ALLOWLIST`** can receive (so it cannot become an open relay); `mode: 'send'` answers 501; From is *our* configured address and the owner's address is only Reply-To; subject is prefixed `[TEST]`; a suppressed address is never mailed (409), and an unreadable suppression list fails closed; blocking content problems refuse the send (400); 5 per hour per user. |
| Client + panel | `email/outreachClient.ts`, `guided/EmailOutreachPanel.tsx` (mounted in the overlay editor) | Compose, merge sample values, sandboxed (`sandbox=""`) live preview, checklist, download HTML / text / `.eml`, "Send me a test" with every failure mapped to a plain message. |

### Defects found by the tests/checks and fixed
* **`@react-email/components` crashed in a plain Node function** (it loads `code-block` → `prismjs`, which needs a DOM `Element`). The jsdom tests hid it; the route test in a Node environment exposed it. The template now imports the eleven individual `@react-email/*` packages (exact versions, MIT) instead.
* `htmlProblems` flagged *escaped* hostile text (e.g. `onerror=` inside an `alt` value) as an event handler; it now checks real tags with quoted values removed.
* The checklist used a standing `role="alert"` per item, which collided with other panels' alerts and is noisy for screen readers; only action results use `alert` now.
* `analyticsClient.test.js` still asserted the old `contact` field removed in Stage 8; updated to the token behaviour (it had not been in the Stage 8 related-suite run).

### Verification actually run
* **Unit/route/panel (51 new):** model/render/eml/unsubscribe/client 18, unsubscribe function 12, outreach route 12, panel 9.
* **SQL assertions 21/21** on a throwaway local Postgres (`supabase/tests/run-email-suppressions-assertions.sh`).
* **Full-stack check 8/8** (`npx vitest run --config scripts/stage9-email-check/vitest.stage9.config.mjs`): the real route + real `nodemailer` + a **real SMTP server on 127.0.0.1** (`smtp-server`), the received message parsed by an independent parser (`mailparser`): multipart, From/Reply-To, `[TEST]` subject, raw `List-Unsubscribe` / one-click headers, unicode subject and body intact; the unsubscribe link **taken from the received email** → GET changes nothing, one-click POST suppresses (hash only in the table), repeat is safe, the next send is refused and never reaches the SMTP server; suppression is per sender; forged/edited tokens record nothing; allow-list blocks strangers; SMTP rejection and server-down → 502 without leaking server details.
* **Mutation checks, 12/12 caught:** signature check removed, GET unsubscribing, allow-list ignored, suppression ignored, From = owner address, client unsubscribe link trusted, token expiry ignored, header-injection cleaning removed, handler scanner removed, duplicate check removed, Send enabled with errors, blocked email still sent.
* `eslint --quiet` on changed in-scope files clean; `npm run typecheck:personalization` 0 errors in scope (98 pre-existing out-of-scope); wider related run (`src/features/personalization`, `netlify`, `src/test`, `src/lib`) green after the two fixes above.

### Limits and open items (not hidden)
* **SMTP acceptance is not inbox delivery.** The check proves a standards-shaped message is handed to an SMTP server; it says nothing about spam placement, Gmail/Outlook rendering, or whether the GIF's first frame displays in Outlook for Windows. Those need real mailboxes and your approval to send.
* **No provider chosen and nothing sent for real.** The route needs your SMTP settings and an allow-list; SPF, DKIM and DMARC for the sending domain are DNS work only you can do and are not verified here.
* **Sending to a list is not built** (`mode: 'send'` is 501). It belongs with Stage 10's batches, once you decide how and where mail is sent. The existing `EmailCampaignModal` is still a simulation.
* **The unsubscribe link in the panel's preview/downloads is a placeholder.** The real, signed link is made per recipient on the server at send time; a downloaded `.eml` therefore carries a non-working example link.
* The migration `20261116000000_email_suppressions.sql` is **not applied**; until it is, the test route answers 502 ("could not check the suppression list") rather than sending.
* Suppression is **per sender account** and keyed on the lower-cased address (plus-addressing and dots are not collapsed).
* The preview is a sandboxed iframe of the generated HTML, not a rendering in real mail clients.


## Stage 10 — Bulk personalization and outreach sequence (2026-11-13)

**Authorization:** the approved Stages 6–12 plan. No server, queue, scheduler or database was added. Nothing was published, emailed or uploaded.

### What was built
| Piece | Where | Notes |
|---|---|---|
| CSV import, mapping, validation, de-duplication, safe export | `bulk/csv.ts` | RFC 4180 parser (quotes, newlines in quotes, CRLF, BOM, `,` `;` tab sniffed), limits (5 MB, 5,000 rows, 60 columns, 500 characters a cell); column → Company / Name / Email / Website / Phone / Location / merge field; every skipped row is reported **with its row number and reason** (no identity, bad email, unusable web address, repeat of row N); control and bidi-override characters removed; repeats removed by email, else by company + website host; ids are stable for the same list (needed to resume); `toCsv` neutralises cells starting `= + - @`. |
| Per-recipient design | `bulk/recipientInput.ts` | Each recipient gets a **copy** of the editor's preview props with their business details and `{{fields}}` (through the existing `customFields`); the base design is never modified (tested). |
| Resumable batch | `bulk/batchJob.ts`, `guided/batchSteps.ts` | Steps per recipient: thumbnail, GIF, video, using the same pipelines as the single-video panels. Saved to **IndexedDB after every step**; finished steps are never redone; a failing step is retried (2 attempts) and then only that recipient fails; pause is prompt and resumable; a full browser storage pauses the whole job with a plain message; one tab at a time (Web Locks); a design change since the batch started blocks resuming. |
| Package | `bulk/outputPackage.ts`, `bulk/zip.ts` | One ZIP: a folder per recipient, `manifest.csv` (spreadsheet-safe, with each recipient's status, files, personal link and failure reason) and a README. Own minimal store-only ZIP writer (the media is already compressed), verified by `unzip` and Python. |
| Panel | `guided/BulkPanel.tsx` (mounted in the overlay editor) | Paste/open CSV, column mapping, issues list, choose steps, start / pause / resume / retry failed / discard, progress bar, saved batch comes back after a reload, optional personal links for a published video (Stage 8 API, in chunks of 50), download package. |
| Outreach sequence | `flow/outreachFlow.ts`, `guided/OutreachFlowPanel.tsx`, `guided/OutreachFlowSection.tsx` | React Flow diagram (`@xyflow/react`, already a dependency, MIT), loaded only when opened. Steps: recipients, make files, email, wait (1–30 days), check (watched / clicked / replied → Yes/No), end. Validation (no loops, no orphans, every check has Yes and No, subjects required, at most 12 emails), a **simulator** for a recipient who watches / doesn't / replies / unsubscribes, plan export (CSV, JSON), editable without dragging (menus). |

### Defects found by the tests/checks and fixed
* **Stored files can vanish in a private window** (found by the real-browser check): IndexedDB returned a file handle whose bytes were gone (`NotFoundError`), at a point *after* a successful read. The runner now (1) treats a stored file as finished only if its bytes can be read, (2) re-verifies recipients already marked done at the start of every run, and (3) when a download finds lost files it does **not** hand over a short package: it marks exactly those steps to be made again, tells the owner to press Resume, and offers "Download without them" explicitly.
* The CSV parser took its width from data rows, so a long row leaked an extra column; the header now defines the columns.
* The panel hid a "storage blocked" warning behind the "Finished" message, and then ran a batch whose files could not be kept; it now refuses to start and explains.
* Mounting React Flow eagerly in the editor broke 131 existing tests (`ResizeObserver`) and would have loaded a diagram library on every editor visit; it is now lazy and opt-in.
* A stale Stage 8 assertion in the unit tests was also corrected in Stage 9; nothing new here.

### Verification actually run
* **Unit/panel (64 new):** CSV, mapping, validation, de-dup, ids, formula safety 17; ZIP (read back by a separately written reader, CRC-32 test vector, path safety) 3; runner (resume, retry, failure isolation, interruption, crash recovery, quota, concurrency, stale files, exclusive runs) 13; per-recipient isolation 3; package 3; flow model 10; panels 18 (import and mapping, batch, failures and retry, pause/resume, saved batch after a reload, design change, second tab, personal links, lost files and partial download, flow editing, drafts).
* **Real-browser check 29/29** (`node scripts/stage10-bulk-check/check.mjs`; headless Chromium, real IndexedDB, real composition, real page reload): a 6-row CSV → 3 recipients (repeat and bad email skipped with row numbers); the batch is interrupted in the **middle of recipient 2**, the **page is closed and reopened**, and it resumes: **every recipient/step completed exactly once across both sessions**, the only repeat is the interrupted step; the ZIP passes `unzip -t` and Python `zipfile` (CRCs, one folder per recipient, safe names); every file is real media (ffprobe: JPEG 320×180, GIF 240×135 with 7 frames, H.264 320×180 ≈ 2 s); each recipient has **their own headline** (pixels differ in the headline area, the shared video is the same) and recipient 1's thumbnail is **pixel-identical (difference 0.00)** to the ordinary single-video thumbnail with "Hi Acme Roofing" typed in; a company named `Cedar {{x}} Dental` is drawn as written; the manifest neutralises `=HYPERLINK(...)` and keeps personal links; plus the private-window case (files lost → remade → complete, readable package).
* **Mutation checks:** 19 unit-level (duplicates, formula neutralising, web-address scheme, bidi characters, redoing finished steps, retry limit, interruption counted as failure, quota, re-verification, crash recovery, CRC, path traversal, value leakage into the base design, manifest safety, short package, design change on resume, loops, unsubscribed recipients, email cap) all caught after two weak tests were strengthened (a redundant-guard mutant and a host:port case); **and one against the live check** (recipients ignoring their own values) which failed 4 checks.
* `eslint --quiet` clean on changed in-scope files; `npm run typecheck:personalization` 0 errors in scope (98 pre-existing out-of-scope); `npx vitest run src/features/personalization netlify src/test src/lib` → 508 files, 6,391 tests passed, 13 skipped.

### Limits and open items (not hidden)
* **Publishing a different rendered video per recipient (deferred from Stage 8) is NOT built.** A published video in this app is a timeline snapshot (`published_videos`), not a rendered MP4, and the plan forbids a new publishing system or storage. What exists instead: per-recipient **files** in a ZIP, and per-recipient **personal links** (Stage 8) to *one* published video. Storing and serving a rendered MP4 per recipient needs your decision (where the files live, who can read them, retention).
* **It is a browser-tab batch, not a background service.** The tab must stay open (a leave-page warning is shown while it runs); a closed tab pauses it and it resumes from what was saved. Concurrency is 1 in the panel. Where Web Locks are missing, two tabs are not prevented from running the same batch.
* **Measured speed is only for the small test clips:** the resumed run made 2 recipients' remaining files (thumbnail, 6-frame GIF, 2-second 320×180 MP4) in about 2.5 s. Nothing is claimed for full-size videos; MP4 export time and memory at 1080p and for long clips are measured in Stage 12.
* **Private windows and storage cleanup can discard stored files**; the repair loop above handles it but costs a remake. A package over 4 GB is refused (no ZIP64). Stored files are deleted when you discard the batch, not automatically.
* **Per-recipient *recordings* are out of scope** (Recorder is excluded and finished in another chat). A batch personalizes the *current* design and source video; whether bulk should drive Recorder output is a decision for you.
* **The outreach sequence is a plan.** Nothing sends, waits or watches anyone: there is no scheduler. "Watched / clicked / replied" are inputs to the *simulation*; real values come from analytics (Stage 11) and the owner. List sending (Stage 9's `mode: 'send'`) is still 501, and the email test-send remains allow-listed.
* CSV only (no XLSX); websites written as `host:port` without `https://` are refused (anything starting `word:` is treated as a scheme); the Email column is stored and used for merge fields, de-duplication and the manifest, not for sending.
* The flow editor was exercised in jsdom and through its menus; dragging nodes and edges was not driven in a real browser, and screen-reader use was not tested.


## Stage 11 — Analytics report, results dashboard, PDF and push notifications (2026-11-14)

**Authorization:** the approved Stages 6–12 plan. The first-party analytics (ingest, summaries, retention, in-app alerts) already existed; this stage adds an owner-checked read, a dashboard, exports and opt-in push on top. **The migration is tested on a throwaway local Postgres only; NOT applied anywhere.** No push was sent to any real device.

### What was built
| Piece | Where | Notes |
|---|---|---|
| Owner-checked report | migration `20261117000000_analytics_report_push.sql` (`analytics_report`), route `analytics-report/route.ts` | Ownership is checked inside SQL (a video that is not yours reads exactly like a missing one: 404); 366-day limit; built from the existing summary/timeseries/retention/CTA functions plus recipient-link counts. |
| Report model, CSV | `report/reportModel.ts`, `reportClient.ts` | The funnel is **by recipient only** (links made → opened → played → finished → action) because those steps count the same thing; other figures are separate, defined tiles; empty rates show "—"; observations are facts, never advice. |
| PDF | `report/pdf.ts`, `reportPdf.ts` | Own minimal PDF 1.4 writer (no dependency), built in the browser: results, over time, by recipient (paginated), how to read. Verified by poppler and pypdf strict; rendered and inspected (found and fixed overlapping labels, an unreadable axis and wrong metadata encoding). |
| Dashboard | `guided/ResultsPanel.tsx` | Tiles with definitions, funnel, plain-language facts, accessible daily chart with a numbers table, per-recipient table, PDF and CSV downloads. |
| Push sender | `netlify/functions/_push/webPush.js` | **Dependency-free** RFC 8291 encryption + RFC 8292 VAPID on `node:crypto` (the `web-push` package is MPL-2.0 with four dependencies; not used). Checked against Mozilla's independent `http_ece` (dev dependency, MIT). **SSRF protection:** endpoints must be https :443 on a known push service host (or `PUSH_ENDPOINT_HOSTS`), never IPs, redirects never followed, checked when saved and again before every send. |
| Which alerts push | `push_claim_for_video` + hook in `video-events.js` | Push is driven by the EXISTING de-duplicated, preference-filtered `owner_notifications`; an atomic claim (SKIP LOCKED) makes it at-most-once; only action alerts (lead, pricing, contact, high interest, returning), under 10 minutes old, unread; nothing is claimed while the owner has no device. Best effort, 2.5 s budget, never changes the viewer's response. |
| Subscriptions | table `push_subscriptions`, route `push/route.ts` | Opt-in; max 10 devices per owner; service-role-only RPCs; test button; the private key appears in no response. |
| Browser | `public/push/sw.js`, `notify/pushClient.ts`, `guided/NotificationsPanel.tsx` | Own worker and scope `/push/` so it **never replaces the app's offline-cache worker** (`/sw.js`); permission is requested only on the click and before any network call; messages can only link into this site; loads nothing until the panel is opened. `AuthLayout.jsx`'s reset now leaves this worker registered. |

### Defects found by tests/checks and fixed
Operator host list accepted IP-looking names; PDF title shown as "Š" (wrong string encoding); overlapping day labels / button-table headers; odd axis ticks; raw action ids as button names; non-Latin names silently became "?" (now stated in the PDF and the panel); the notifications panel called the server on every editor open (now on demand); a replacement of the app's service worker was avoided by design.

### Verification actually run
* SQL assertions (`supabase/tests/run-analytics-report-push-assertions.sh`, 40+ checks): ownership, exact counts from real ingested events, privileges, subscription limits and moves, claim rules (no subscription, once only, per owner, limit, staleness, read, type).
* Unit/route/panel: sender 21 (RFC key schedule through an independent decryptor, VAPID signature, SSRF table, fan-out), video-events push 4, report model/PDF 17, routes 23, worker + client 17, panels 7.
* **Full-stack 8/8** (`scripts/stage11-report-check`): events replayed through the real handler appear in the report with those numbers, retries change nothing, another owner gets 404, the PDF from the real report passes `pdfinfo`, `pdftotext` and pypdf strict, a lead pushes to both devices and decrypts to the real alert, a retry pushes nothing, **4 parallel claims never share an alert**, the test button works and a gone device (410) is forgotten, another owner's activity pushes nothing.
* **14 mutations caught** (SQL ownership, re-push, staleness; allow-list, key schedule, redirects; route endpoint check and trusting a request user id; worker URL; PDF xref; funnel; empty rates; early prompt; push on plain views).
* eslint clean; typecheck 0 in scope; broad run 549 files, 6,977 passed; one unrelated `upload_file` test flaked under load and passes alone, also on a clean tree.

### Limits and open items (not hidden)
* **No real browser received a push.** That needs your VAPID keys (`node scripts/make-vapid-keys.mjs`; set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in the server environment) and a real subscription. iPhone/iPad need the site added to the Home Screen.
* Migration not applied; until it is, the report route answers 502 and the panel says storage is unavailable.
* At-most-once: if a send fails after the claim, that alert is not retried (it stays in the in-app list).
* The PDF uses standard fonts: non-Latin scripts and emoji appear as "?" (stated in the file; the CSV is complete).
* Numbers exclude visitors who block analytics or send Do Not Track; unique viewers are a lower bound (the report says how many visits had no id). Days are UTC.


## Stage 12 — Recovery, long-clip limit, end-to-end run, final validation (2026-11-14)

### What was built
| Piece | Where | Notes |
|---|---|---|
| Autosave with history | `recovery/{snapshot,draftStore,autosaver}.ts`, `guided/RecoveryPanel.tsx` (mounted in the overlay editor) | Debounced; identical content is not rewritten; newest 5 drafts kept; stored in the **Origin Private File System** (temp file then swap, so a failed write cannot damage the last draft), else IndexedDB, else the panel says autosave is unavailable; a store that does not answer within 3 s counts as unavailable. |
| Recovery | same | After a closed or crashed page the last draft is offered if it differs from what is on screen; autosave is **paused while the offer is open** so the draft is not pushed down the history; items that existed only in browser memory (`blob:` URLs) are removed, counted and reported. |
| Cross-tab safety | `autosaver.ts` | Writes run under an exclusive **Web Lock**; a **BroadcastChannel** tells other tabs; a tab holding unsaved edits that hears another tab saved reports a **conflict** and lets the owner choose (use theirs / keep mine), never overwriting silently. |
| Backup archive | `snapshot.ts` (`buildBackup`/`readBackup`), `bulk/zip.ts` (`readZip`) | A .zip with manifest, settings and README. The reader accepts only archives this app writes and refuses compressed, encrypted, oversized, too-many-file, damaged (CRC), checksum-mismatched, newer-version and path-traversal archives. |
| Long-clip limit | `guided/audioMixdown.ts` (`MAX_MIX_SECONDS = 600`) | **Measured** (Node, stereo 44.1 kHz voice + music): peak memory ~85 MB per minute of audio: 1 min 0.45 GB, 10 min 2.4 GB (17 s), 30 min 5.1 GB (51 s), 60 min 8.9 GB (100 s). Past a browser tab's limits the tab would crash with the work in it, so mixes over 10 minutes are refused up front with a plain message (turn the mix off to export with the original sound). This closes the open Stage 4 gap. |

### Defects found by the tests/checks and fixed
* A storage probe could wait forever on a store that never answers: now time-limited.
* The panel re-created its autosaver whenever an inline callback changed: callbacks are read through a ref.
* The conflict banner stayed after choosing the other tab's draft.
* Final validation found: a literal BOM character in Stage 6's own test (lint), and the check harness for Stages 3-7 pre-bundled a fixed list of dependencies that no longer covered `react-dom/server` (pulled in by Stage 9's email renderer), giving a `require is not defined` page error in every check that mounts the editor. Fixed in the harness (production build unaffected); all five checks re-run green.

### Verification actually run
* Unit/panel: recovery 20 (snapshots, stores incl. a failing write, autosaver with fake locks/channel/timers, ZIP reader hostile cases, backup round trip and tampering), panel 7, long-clip guard 1.
* **Real-browser check 15/15** (`scripts/stage12-recovery-check`): the real OPFS store; history survives a page close and reopen; only 5 drafts kept; **80 interleaved saves from two tabs never corrupt the draft**; a second tab with unsaved edits is told by the real BroadcastChannel; an aborted OPFS write leaves the old content; the backup passes `unzip -t` and Python `zipfile`, is restored by the app, and a one-byte change is refused; private-window profile works.
* **End-to-end chain 9/9** (`scripts/stage12-e2e-check`, real SQL + real SMTP server + local push service): personal links (hashes only) → three personalized emails with each recipient's link, signed unsubscribe and GIF → views/plays/finish attributed to the right recipient → a click and a form push exactly one notification per alert, decrypted by an independent reader → forged contact id and wrong token attribute nothing → the report shows each recipient's journey and another owner gets 404 → the PDF carries all three names → unsubscribe works (GET does nothing, one-click records) and later sends are refused → a revoked link stops attributing.
* 13 mutations caught (guard, ZIP CRC, unsafe names, per-file limit, backup checksum, history cap, blob stripping, conflict, lock, rewrite, offer, pause, probe timeout).

### Limits and open items (not hidden)
* Drafts and backups hold the **design settings only**: not the video, music, pictures or recordings. Memory-only items are not restored and are listed.
* The memory measurements are from Node on the pure mixdown; a real tab adds decode and export overhead, which is why the limit is 10 minutes and not higher. Full-length 1080p video export time/memory was not measured.
* Web Locks and BroadcastChannel were exercised in Chromium only; where they are missing, two tabs are not prevented from writing, and conflicts are not announced. OPFS was probed in Chromium (including a private window); Safari/Firefox were not tested.
