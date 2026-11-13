# SmartVideo AI — Stage Status

| Stage | Title | State | Approval | Completed | Commit | Tests | Remaining issues |
|---|---|---|---|---|---|---|---|
| 0 | Application & feature audit | **Complete (audit-only)** | Authorized by the master prompt (Stage 0 only) | 2026-11-13 | see `git log` for the commit titled "Stage 0 audit" | Baseline below | See master plan §5 |
| 1 | Personalization data & visual editing | **Complete and verified** (see limits in the Stage 1 completion section) | Authorized by the user ("continue with the next phase", then "complete all of stage 1") | 2026-11-13 | see `git log` ("Stage 1 completion") | Full suite 766/766 files, 10,988 passed, 0 failed, 61 skipped; typecheck gate 0 errors; eslint src 0 errors; live checks 8/8, 19/19, 31/31; SQL 40/40 | Migration for synced layouts is **not applied** anywhere |
| 2 | Website backgrounds & business assets | Not started | **NOT authorized** | — | — | — | — |
| 3 | MediaPipe presenter effects | Not started | **NOT authorized** | — | — | — | — |
| 4 | Advanced browser audio | Not started | **NOT authorized** | — | — | — | — |
| 5 | Advanced video effects & motion | Not started | **NOT authorized** | — | — | — | — |
| 6 | Captions, text & intelligent editing | Not started | **NOT authorized** | — | — | — | — |
| 7 | Thumbnails & personalized GIFs | Not started | **NOT authorized** | — | — | — | — |
| 8 | Personalized publishing & watch pages | Not started | **NOT authorized** | — | — | — | — |
| 9 | React Email & outreach | Not started | **NOT authorized** | — | — | — | — |
| 10 | Bulk personalization & automations | Not started | **NOT authorized** | — | — | — | — |
| 11 | Analytics, notifications & reporting | Not started | **NOT authorized** | — | — | — | — |
| 12 | Performance, recovery & final validation | Not started | **NOT authorized** | — | — | — | — |

**Next authorized stage: none.** Stage 1 is the last authorized stage. Stage 2 requires an explicit user instruction (e.g. "Approved. Start Stage 2."), or an instruction to fix Stage 1.

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
