# Feature Completion Matrix — remix-new-editor consolidation

**Generated:** 2026-10-12
**Generator:** Lead (synthesized from SA-1, SA-2, SA-3, and prior SA-old-3 remix integration audit).
**Repo:** /Users/shasheemoore/Downloads/remix-new-editor (main @ `4522e42dc`).

## 1. Feature Matrix

| Feature | Source branch / commit | Current status | Remaining work | Verification |
|---|---|---|---|---|
| **Render Studio** (rendering, audio capture, playback, progress) | main `4522e42dc` + `fix/render-core-media-cert` `1003ee696` (worktree #10, now merged) | **COMPLETE** (in main) — `src/components/RenderPage.js` uses `MediaRecorder` + `MediaStream.addTrack` for source-audio capture; `src/lib/editor/render{AiActions,Helpers,Media,Queue,FrameProcessor,ExportWorker}.js` provide the pipeline. | None for the core. Phase 5 will wire personalization assets into Render Studio inputs. | Unit tests: `src/test/render-{actions,ai-actions,export-worker,frame-processor,queue-store}*.test.js` exist and run. |
| **CineGen** (web port with MuAPI video gen) | `feature/cinegen-web-full-port` (worktree #9 = `db81a7a7e`) + `feature/timeline-node-cinegen-parity` (worktree #11 = `1aa2799e1`) | **INCOMPLETE** — `apps/cinegen-web` and `apps/cinegen-studio` are NOT in main. Only `src/lib/cinegen.js` (81 lines, MuAPI-backed adapter) is on main. | Port `apps/cinegen-web` and/or `apps/cinegen-studio` to main as part of CineGen integration; preserve MuAPI + OpenAI image editing + auth. **Out of scope for personalization**; tracked separately. | `scripts/verify-video-agent-studio.mjs` is FAIL (OpenChatCut subtree build broken on main). |
| **AI image generation** (OpenAI direct + via MuAPI) | main `4522e42dc` | **COMPLETE** (in main) — `src/lib/openaiService.js#OpenAIService` exposes `generateImageDirect` (POST `/v1/images/generations` with `gpt-image-2` default, `line 665`), `imageGenerationResponses` / `multiTurnImageEditing` / `editImageResponses` / `imageGenerationResponsesStream` (POST `/v1/responses`, lines 1017/1091/1177/1248), and `createFile` (POST `/v1/files`, line 1352). All via raw `fetch` (no SDK). | Phase 4 will reuse this client. | `src/test/openai*` tests exist. |
| **OpenAI Responses API integration** (for assistant workflows) | main `4522e42dc` | **COMPLETE** (in main) — used by `openaiService.js` (4 sites), `openaiResponses.js` (Render AI Auto-Edit planner, `gpt-4.1` + JSON schema), `gtmResponses.js` (GTM Boost), `socialPostEnhancer.js`. Default model: `gpt-5.6` (openaiService), `gpt-4.1` (Render), `gpt-4.1-mini` (GTM/social). | Phase 4.4 will add a 5th use site (PersonalizationModal AI Assist). | Tests exist per use site. |
| **MuAPI video generation** (T2V/I2V/V2V/face-swap) | main `4522e42dc` | **COMPLETE** (in main) — `src/lib/muapi.js#MuapiClient` (2174 lines) proxies all generation through `${VITE_SUPABASE_URL}/functions/v1/muapi-proxy` (Supabase Edge Function) with body `{ endpoint, params, generationType, studioType }`. | Phase 5 will pass persona assets in the `params` payload. | Model catalog in `src/lib/muapi/catalog.js` + `src/lib/muapi/model-mapping.js`. |
| **MuAPI file uploads** (≤8 MB via Supabase proxy, >8 MB direct) | main `4522e42dc` | **COMPLETE** (in main) — `src/lib/muapi.js#uploadFile` (line 740) for small files via Supabase Edge Function; `_uploadDirectToMuapi` (line 937) for large files. | Phase 4.5 will standardize the upload pipeline against the verified MuAPI contract. | Upload pipeline tests in `src/test/uploads-bucket-allowlist.test.ts` + `src/lib/editor/uploadPipeline.js` tests. |
| **Media persistence + gallery** (Supabase storage + RLS) | main `4522e42dc` | **PARTIAL** — Supabase bucket `uploads` (public-read, anonymous-insert/delete, no per-user RLS); per-user scoping via `getUserKey()` path prefix. 28 SQL migrations in `supabase/migrations/`. `content_library` has RLS. | Phase 4.5 will add the `personalization_outputs` table with RLS via Clerk `set_config`. | SQL migrations runnable; no test harness. |
| **Personalization (existing)** (PersonalizeModal, Personalizer canvas, handoff) | main `4522e42dc` | **PARTIAL** — `PersonalizeModal.jsx` (3442 lines, COMPLETE), `PersonalizePage.js` (STUB/LEGACY), `VideoPersonalizationHub.jsx` (UI shell, PARTIAL), `Personalizer.js` (1672 lines, COMPLETE), `personalizerHandoff.js` + `personalizerAdapters.js` (COMPLETE), `personalizePopover.js` (COMPLETE). Adapters `getVideoStudioAsset` / `getImageStudioAsset` / `getTemplateStudioAsset` exist but are UNUSED. | Phase 4 will port the OpenHiggsBolt personalization (profiles, asset library, AI Assist) and wire the adapters into VideoStudio/ImageStudio/TemplateStudio. **PersonalizePage.js** is DEAD in main (App.js not imported); `VideoPersonalizationHub.jsx` has no real backend. | `src/test/personalizer*.test.js`, `personalize-tokens.test.js` exist and run. |
| **AI Assist** (image editing inside PersonalizationModal) | NOT in main | **MISSING** — OpenHiggsBolt has it (uses `gpt-image-2-edit` via MuAPI). | Phase 4.4 will port. | Will reuse existing OpenAI service + new `gpt-image-2-edit` MuAPI wiring. |
| **Clerk authentication** | main `4522e42dc` | **COMPLETE** (in main) — `src/lib/clerkInit.js` exports `Clerk` singleton + `ensureClerkLoaded()`. `<ClerkProvider>` mounted in `ClerkAuth.jsx:38` and `HeaderAuth.jsx:67`. `useUser()` is the canonical identity hook. | Phase 4.5 will sync `user.id` → `offlineStorage` so `getUserKey()` (already wired) returns the Clerk userId for the `personalization_outputs.clerk_user_id` field. | E2E sign-in tests in `src/test/auth/`. |
| **Supabase user isolation + storage** | main `4522e42dc` | **PARTIAL** — RLS exists for `content_library` and multi-tenant core; `uploads` bucket has NO per-user RLS (per SQL comment, "Anonymous upload access since the app uses API keys (not Supabase Auth)"). User scoping relies on `getUserKey()` path prefix. | Phase 4.5 will add proper Clerk `set_config` RLS for the new `personalization_outputs` table, mirroring OpenHiggsBolt. | SQL migrations runnable. |
| **Website Builder** (OpenThorn iframe) | main `4522e42dc` | **COMPLETE** (in main) — `src/components/OpenThornStudio.js` is an iframe wrapper for `apps/openthorn/`. Route `website-builder` in `src/lib/router.js:81`; sidebar entry `src/components/Sidebar.js:47`. Build via `npm run build:openthorn` which copies to `public/openthorn/`. | None. Phase 5 does not modify Website Builder. | `src/test/website-builder-regression.test.js` (4/4 substantive checks pass). Build step passes (42s). |
| **Application navigation + menus** | main `4522e42dc` | **COMPLETE with bugs** (in main) — `src/lib/router.js` (204 lines, `pageLoaders` map), `src/lib/studioRoutes.js` (single source of truth for studio drawer), `src/components/Sidebar.js` (160 lines, 41 nav items at lines 8-48). Issues: duplicate `ai-vfx` at lines 27+45; non-functional `commits` at line 44; `pexels-media` at line 46 not in router. | None required. The `personalizer` entry at line 25 + `studioRoutes.js:108` is the canonical destination for personalization handoffs. | Router tests pass. |
| **Rendering / export / playback core** (Render Studio + Cinema + Template) | main `4522e42dc` | **COMPLETE** (in main) — `MediaRecorder` + `MediaStream` audio capture in `src/components/RenderPage.js:687-1021`. `@ffmpeg/ffmpeg` in deps (used by `src/lib/editor/exportWorker.js`). | None for the core. Phase 5 will not modify Timeline Editor per master-mission directive. | Build succeeds; render tests pass. |
| **Tests + deployment** | main `4522e42dc` | **PARTIAL** — Vitest 4.1.2 + Playwright 1.61.1 + Puppeteer 24.43.1. 54 root test files (`src/test/`, `src/tests/`, `src/components/__tests__/`). GitHub workflows `ci.yml`, `deploy-production.yml`, `deploy-staging.yml`, `template-to-video-ci.yml`. `netlify.toml` (108 lines) + `render.yaml` (91 lines, 3 services). **Baseline is RED** per SA-3: lint 14 errors, tests 17/2633 fail, OpenChatCut subtree build broken. | Phase 7 will report baseline status; integration must not regress. | `scripts/lint-timeline-tokens.cjs` PASS, `scripts/check-cinema-hex.mjs` PASS, `scripts/check-endpoint-coverage.mjs` PASS, `scripts/check-minimax-licensing.js` PASS (w/ advisories). |
| **Personalization <-> studio integration** (adapters exist, no live call sites) | main `4522e42dc` | **INCOMPLETE** — `getVideoStudioAsset` / `getImageStudioAsset` / `getTemplateStudioAsset` exist in `src/lib/personalizerAdapters.js` but are not called by VideoStudio/ImageStudio/TemplateStudio. InfluencerStudio (`src/components/InfluencerStudio.js:8,815,1134`) and StoryboardStudio (`src/components/StoryboardStudio.js:7,724,1589`) do prompt-time `replaceTokensInPrompt` but not asset-level injection. | Phase 5 will wire the adapters into Render Studio + CineGen. | Adapter unit tests are absent. |

## 2. Personalization Feature Sub-Matrix (port from OpenHiggsBolt)

| Sub-feature | OpenHiggsBolt state | remix-new-editor state | Required action |
|---|---|---|---|
| Who-Is-This-For selector | COMPLETE | MISSING in PersonalizeModal | Port from `PersonalizationModal.tsx:1122` |
| Client Profile form | COMPLETE | MISSING | Port from `PersonalizationModal.tsx:1145` |
| Asset library — face/identity | COMPLETE | STUB (no grid UI) | Port from `PersonalizationModal.tsx:1216` |
| Asset library — logo | COMPLETE | STUB | Port from `PersonalizationModal.tsx:1259` |
| Asset library — products | COMPLETE | STUB | Port from `PersonalizationModal.tsx:1305` |
| Asset library — brand references | COMPLETE | STUB | Port from `PersonalizationModal.tsx:1338` |
| Asset library — first frame | COMPLETE | STUB | Port from `PersonalizationModal.tsx:1371` |
| Asset library — last frame | COMPLETE | STUB | Port from `PersonalizationModal.tsx:1408` |
| Asset library — audio | COMPLETE | MISSING | Port |
| Asset library — drag-drop reorder | COMPLETE (native HTML5) | MISSING | Port (no dnd-kit dep required) |
| Asset library — primary selection | COMPLETE | STUB | Port |
| Asset library — remove | COMPLETE | STUB | Port |
| Persistent saved state (localStorage) | COMPLETE | PARTIAL (only token-based prompts) | Port `clientProfile.ts` + `sharedMedia.ts` |
| Website asset discovery | MISSING in OpenHiggsBolt | MISSING in remix-new-editor | **GREENFIELD**: Crawlee + Cheerio + headless + SSRF/private-IP/DNS-rebinding/dup/social-domain/junk guards + async job+status |
| AI Assist — Person/Logo/Product/Brand/FirstFrame/LastFrame | COMPLETE (via `gpt-image-2-edit` + MuAPI router) | MISSING | Port `generationRouter.ts` + `modelCapabilityResolver.ts` |
| Prompt rewrite | COMPLETE (via `gpt-4o` + Supabase Edge `enhance-prompt`) | MISSING | Port `promptPersonalizer.ts` |
| Post-processing (logo watermark, end-card) | COMPLETE | MISSING | Port `postProcessor.ts` |
| OpenAI Responses API image_generation tool | COMPLETE in OpenHiggsBolt proxy; also in main openaiService.js | COMPLETE in main | Reuse `openaiService.editImageResponses` (action='edit', line 1177) |
| MuAPI file upload for assets | COMPLETE (XHR, 300s timeout) | COMPLETE in main (fetch with retry, uploadPipeline.js) | Standardize against verified contract |
| Supabase persistent storage | COMPLETE (`personalization_outputs` table) | MISSING | Add new SQL migration |
| Cross-studio handoff | COMPLETE | COMPLETE (`personalizerHandoff.js`) | Reuse |
| Adapter layer to studios | COMPLETE in OpenHiggsBolt | COMPLETE but UNUSED (`personalizerAdapters.js`) | Wire in Phase 5 |
| Auth (Clerk) | COMPLETE | COMPLETE in main | Reuse |

## 3. Test Plan (Phase 7)

| Layer | Tests to add/run | Pass criteria |
|---|---|---|
| Unit (vitest) | `src/components/personalize/__tests__/clientProfileStore.test.js`, `sharedMediaStore.test.js`, `modelCapabilityResolver.test.js`, `postProcessor.test.js`, `PersonalizeProvider.test.jsx` | All pass |
| Integration | `personalize-modal-flow.test.js` (mock MuAPI + OpenAI), `personalization-record-api.test.js` (mock Supabase) | All pass |
| E2E (Playwright) | `e2e/personalization.spec.ts` (create profile → upload assets → AI Assist → save output → cross-studio handoff) | All pass |
| Lint | `npm run lint` (no new errors vs main) | Same 14 pre-existing errors, 0 new |
| Typecheck | n/a (no tsc script) | n/a |
| Build | `npm run build:openthorn && npx vite build` | Both exit 0 (same baseline) |
| Security | `scripts/check-cinema-hex.mjs`, custom SSRF probe of `discovery/index.js` | Pass; no SSRF allowed |
| Personalization | `src/test/personalizer*.test.js` (existing) + new ports | All pass |
| Render Studio regression | `src/test/render-*.test.js` | All pass (no regression) |
| CineGen regression | `src/lib/cinegen.js` tests if any | Pass (no regression) |
| Baseline re-check | `npm run test:run` total counts vs SA-3 baseline (132 passed / 22 failed / 2633 tests) | New failures: 0; new passes: ≥ 6 (new unit tests) |

## 4. Blockers (carried from SA-3 baseline)

1. **Lint baseline:** 14 `no-case-declarations` errors in `src/lib/{ai/muapiService.js, directorClient.js, editor/animationControls.jsx, editor/assetImportService.js, editor/cameraState.js, gtmResponses.js, openaiResponses.js, request.js, services/SecurityService.js, validator.js, timelineAgentIntegration.js}`. **Pre-existing in main, NOT caused by integration.** Phase 7 documents; not a Phase 4/5 blocker.
2. **Test baseline:** 17/2633 tests fail across 22 files. Root causes: (a) esbuild `TextEncoder` invariant under Vitest 4 + Node 24, (b) `enhanceMenu is not defined` in `AvatarStudio.js:267`, (c) timeline source-string assertions out of sync, (d) sub-workspace pathing issues. **Pre-existing in main.** Phase 7 documents.
3. **`verify:video-agent-studio`:** FAIL (OpenChatCut subtree build broken on main). **Pre-existing.** Phase 7 documents as out-of-scope for the personalization mission.
4. **`AICaptionsModal.jsx`:** duplicate `setupEventListeners` class member (esbuild warning, build still passes). **Pre-existing.** Phase 7 documents.
5. **`vite.config.js` `model-catalog` plugin self-skips:** `[model-catalog] Build plugin skipped: Dynamic require of "/.../src/lib/models.js" is not supported`. **Pre-existing.** Phase 7 documents.
6. **Dirty main at audit time:** 3 files (`eslint.config.js`, `src/components/TimelineEditorPage.jsx`, `src/test/protected-upload-baseline.test.ts`) — stashed into `stash@{0}` 2026-10-12. **Preserved; not lost.**

## 5. No-Regret Decisions Already Made

- **Integration worktree** at `/Users/shasheemoore/Downloads/remix-integration-worktree` on branch `integration/personalization-complete` @ `4522e42dc`. **NOT** yet pushed (no remote `origin/integration/personalization-complete` until Phase 8 commit).
- **Dirty main files** preserved in `stash@{0}` 2026-10-12.
- **5 critical worktrees retained:** main, audit-the-video-generation, port-cinegent, render-studio, remix-new-editor-leadfinder, internal-turner (justification in `WORKTREE_INVENTORY.md`).
- **20 worktrees safe to close** in Phase 2 (all class A or D, per `WORKTREE_INVENTORY.md` §6). Not yet closed — awaiting user approval per master-mission safety rules.
