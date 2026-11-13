# SmartVideo AI — Stage Status

| Stage | Title | State | Approval | Completed | Commit | Tests | Remaining issues |
|---|---|---|---|---|---|---|---|
| 0 | Application & feature audit | **Complete (audit-only)** | Authorized by the master prompt (Stage 0 only) | 2026-11-13 | see `git log` for the commit titled "Stage 0 audit" | Baseline below | See master plan §5 |
| 1 | Personalization data & visual editing | **Complete and verified** (see limits in the Stage 1 completion section) | Authorized by the user ("continue with the next phase", then "complete all of stage 1") | 2026-11-13 | see `git log` ("Stage 1 completion") | Full suite 766/766 files, 10,988 passed, 0 failed, 61 skipped; typecheck gate 0 errors; eslint src 0 errors; live checks 8/8, 19/19, 31/31; SQL 40/40 | Migration for synced layouts is **not applied** anywhere |
| 2 | Website backgrounds & business assets | **Complete and verified** (limits listed in the Stage 2 section) | Authorized by the user (approval of the roadmap plan, which authorized Stage 2 only) | 2026-11-13 | see `git log` ("Stage 2") | Full suite 770/770 files, 11,114 passed, 0 failed, 61 skipped; typecheck gate 0; eslint src 0 errors; Stage 2 real-chain check 29/29 | Capture bucket is still public-by-URL; see limits |
| 3 | MediaPipe presenter effects | **Complete and verified** (limits listed in the Stage 3 section) | Authorized by the user ("let's only check every 3 phases": Stages 3–5 run back to back, then stop) | 2026-11-13 | see `git log` ("Stage 3") | Stage 3 unit/panel tests 78; personalization suite 191 files, 2,360 passed; typecheck gate 0; live check 53/53 (see below) | Processed footage is stored in the browser only; see limits |
| 4 | Advanced browser audio | **Complete and verified** (limits in the Stage 4 section) | Authorized (3-stage cadence) | 2026-11-13 | see `git log` ("Stage 4") | 71 unit/panel/composition tests; personalization suite 194 files, 2,431 passed; typecheck gate 0; live check 40/40 | Mixdown stored in the browser only; tested on short clips only |
| 5 | Advanced video effects & motion | **Complete and verified** (limits in the Stage 5 section) | Authorized (3-stage cadence) | 2026-11-13 | see `git log` ("Stage 5") | 48 unit/panel/composition tests; personalization suite 197 files, 2,479 passed; typecheck gate 0; live check 40/40 | Transitions beyond the existing website hand-over and the GL effect system were not touched |
| 6 | Captions, text & intelligent editing | Not started | **NOT authorized** | — | — | — | — |
| 7 | Thumbnails & personalized GIFs | Not started | **NOT authorized** | — | — | — | — |
| 8 | Personalized publishing & watch pages | Not started | **NOT authorized** | — | — | — | — |
| 9 | React Email & outreach | Not started | **NOT authorized** | — | — | — | — |
| 10 | Bulk personalization & automations | Not started | **NOT authorized** | — | — | — | — |
| 11 | Analytics, notifications & reporting | Not started | **NOT authorized** | — | — | — | — |
| 12 | Performance, recovery & final validation | Not started | **NOT authorized** | — | — | — | — |

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
