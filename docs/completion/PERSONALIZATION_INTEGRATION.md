# Personalization Integration Record — OpenHiggsBolt → remix-new-editor

**Generated:** 2026-10-12
**Generator:** Documentation Engineer (Phase 7)
**Source:** /Users/shasheemoore/Downloads/oldhiggsfieldbolt/OpenHiggsBolt @ `3d041d3b` ("fix: remove scope violations from Task 5") — per `docs/completion/PERSONALIZATION_SOURCE_AUDIT.md` §1
**Target:** /Users/shasheemoore/Downloads/remix-integration-worktree, branch `integration/personalization-complete` (base `4522e42dc`, HEAD `23b322009`)
**Commits:** `021fe4c8a` (core port, 15 files, 3167 insertions) · `23b322009` (greenfield discovery, 14 files, 2255 insertions)
**Audit sources reused:** `docs/completion/PERSONALIZATION_SOURCE_AUDIT.md` (SA-2), `docs/completion/FEATURE_COMPLETION_MATRIX.md` (Lead)

## 1. What Was Ported — File Register (real LOC, `wc -l`)

All files verified in the worktree. "Source" = ported from OpenHiggsBolt; "greenfield" = written for remix-new-editor; "existing" = pre-existing on main (not part of this integration).

### 1.1 Committed in `021fe4c8a` (personalization core)

| File | LOC | Source file (OpenHiggsBolt) | Status |
|---|---|---|---|
| `src/components/personalize/types.js` | 309 | `src/shared/personalization/types.ts` (TS → JSDoc typedefs; all 12 `AssetRole` values kept, `types.js:84`) | ported |
| `src/components/personalize/clientProfileStore.js` | 224 | `src/shared/personalization/clientProfile.ts` | ported, rewritten |
| `src/components/personalize/assetLibraryStore.js` | 317 | `src/shared/personalization/DemoPersonalizeProvider.tsx` (Context → store) | ported, rewritten |
| `src/components/personalize/sharedMediaStore.js` | 157 | `src/shared/personalization/sharedMedia.ts` | ported |
| `src/components/personalize/sourceNormalizer.js` | 214 | `src/shared/personalization/sourceNormalizer.ts` | ported, pure mapping |
| `src/components/personalize/modelCapabilityResolver.js` | 363 | `src/shared/personalization/modelCapabilityResolver.ts` | ported |
| `src/components/personalize/generationRouter.js` | 341 | `src/shared/personalization/generationRouter.ts` | ported, re-based onto `src/lib/muapi.js` |
| `src/components/personalize/index.js` | 49 | `src/shared/personalization/index.ts` | ported (barrel) |
| `supabase/migrations/20261012000000_create_personalization_outputs.sql` | 87 | `supabase/migrations/20260905000000_create_personalization_outputs.sql` | ported, RLS rewritten |
| `src/components/personalize/__tests__/assetLibraryStore.test.js` | 164 | `__tests__/DemoPersonalizeProvider.test.tsx` (subset) | ported |
| `src/components/personalize/__tests__/clientProfileStore.test.js` | 126 | (new) | greenfield |
| `src/components/personalize/__tests__/sharedMediaStore.test.js` | 99 | (new) | greenfield |
| `src/components/personalize/__tests__/sourceNormalizer.test.js` | 201 | (new) | greenfield |
| `src/components/personalize/__tests__/modelCapabilityResolver.test.js` | 197 | `__tests__/modelCapabilityResolver.test.ts` | ported |
| `src/components/personalize/__tests__/generationRouter.test.js` | 319 | (new) | greenfield |

### 1.2 Committed in `23b322009` (greenfield website asset discovery)

| File | LOC | Source | Status |
|---|---|---|---|
| `src/components/personalize/discovery/urlSafety.js` | 404 | — | greenfield |
| `src/components/personalize/discovery/htmlParser.js` | 313 | — | greenfield |
| `src/components/personalize/discovery/staticFetch.js` | 202 | — | greenfield |
| `src/components/personalize/discovery/index.js` | 184 | — | greenfield |
| `src/components/personalize/discovery/worker.js` | 147 | — | greenfield |
| `src/components/personalize/discovery/headlessFallback.js` | 122 | — | greenfield |
| `src/components/personalize/discovery/dedup.js` | 121 | — | greenfield |
| `src/components/personalize/discovery/sitemap.js` | 95 | — | greenfield |
| `src/components/personalize/discovery/__tests__/urlSafety.test.js` | 174 | — | greenfield |
| `src/components/personalize/discovery/__tests__/staticFetch.test.js` | 125 | — | greenfield |
| `src/components/personalize/discovery/__tests__/sitemap.test.js` | 97 | — | greenfield |
| `src/components/personalize/discovery/__tests__/dedup.test.js` | 90 | — | greenfield |
| `src/components/personalize/discovery/__tests__/htmlParser.test.js` | 82 | — | greenfield |
| `src/components/personalize/discovery/__tests__/worker.test.js` | 85 | — | greenfield |

### 1.3 UNTRACKED WIP in the worktree (not yet committed — must be reviewed, tested, committed before merge)

| File | LOC | Status |
|---|---|---|
| `src/components/personalize/personalizeAiAssist.js` | 397 | AI Assist bridge (OpenAI image edit + MuAPI video intent) — WIP |
| `src/components/personalize/studioBridge.js` | 253 | Isolated studio compatibility layer — WIP |
| `src/components/personalize/__tests__/personalizeAiAssist.test.js` | 324 | WIP |
| `src/components/personalize/__tests__/studioBridge.test.js` | 221 | WIP |
| `src/components/personalize/__tests__/zzdbg.test.js` | 19 | **debug leftover — must be deleted before merge** (deliberately-failing `toBe('REVEAL')` assertion, lines 17-18) |

### 1.4 Pre-existing files (on main `4522e42dc`, commit `34836da4a` — NOT part of this integration)

`src/components/personalize/personalizePopover.js` (303), `src/components/personalize/tokenSchema.js` (245).

**Totals (verified `wc -l`):** committed code = 3,562 LOC — 1,974 (8 core modules in §1.1) + 1,588 (8 discovery modules in §1.2) — plus the 87-LOC SQL migration. Committed tests = 1,759 LOC across 12 files (**166 tests, all passing**; the discovery suite alone is 96 tests in 6 files). WIP (uncommitted) = 1,195 LOC across 5 files (650 code + 545 tests, 42 tests + 1 debug test). No new npm dependencies were added (discovery uses Node builtins with dynamic imports of cheerio/linkedom/node-html-parser when present, regex fallback otherwise — `discovery/htmlParser.js`).

## 2. The 8 Personalization Capability Areas (master mission)

| # | Capability area | Status | Implementing files |
|---|---|---|---|
| 1 | **Profiles** (Who-Is-This-For, Client Profile, persistent prefs) | **IMPLEMENTED** (data layer; UI NOT ported) | `clientProfileStore.js` (224, localStorage CRUD + `useClientProfileStore`/`useClients`/`useCurrentClientId` hooks), `types.js:46-62` `ClientProfile` + `EMPTY_CLIENT`. Tests: `__tests__/clientProfileStore.test.js` (126, all passing) |
| 2 | **Asset library** (face/body/side, logos, products, brand, first/last frame, audio, primary, remove) | **PARTIAL** — data layer IMPLEMENTED, UI (grid, drag-drop, primary/remove controls) NOT ported | `assetLibraryStore.js` (317; 12 `AssetRole` values per `types.js:84`, primary setters, remove, `useSyncExternalStore` hooks), `types.js:88-132`. Tests: `__tests__/assetLibraryStore.test.js` (164, passing). `PersonalizationModal.tsx` (1745-LOC source UI) NOT ported |
| 3 | **Website asset discovery** (sitemap, crawler, SSRF, private-IP, DNS-rebinding, dup, social-domain, junk, async job+status) | **IMPLEMENTED** (greenfield) | `discovery/urlSafety.js` (404: `isPrivateIp` `:171`, `validateUrl` `:189`, `reResolveGuard` DNS-rebind re-check `:304`, `checkSocialDomainBlock` `:355`, junk-extension + 2048-char-length guards), `discovery/staticFetch.js` (202: manual redirect loop max 3, per-hop rebind re-validation, 30s timeout), `discovery/sitemap.js` (95: `/sitemap.xml` + `/sitemap_index.xml`, hard cap 50 URLs), `discovery/htmlParser.js` (313), `discovery/headlessFallback.js` (122: opt-in Puppeteer, 30s cap, never throws), `discovery/dedup.js` (121: normalized-URL + SHA-256), `discovery/worker.js` (147: async job store, 3-concurrent cap, 60s/URL timeout), `discovery/index.js` (184: `discoverAssets`/`getJobStatus`/`cancelJob`/`listJobs`). 96 unit tests (6 files) — all passing. **Not wired into the asset library or any UI** |
| 4 | **AI Assist** (Person/Logo/Product/Brand/FirstFrame/LastFrame editing) | **IMPLEMENTED (WIP, uncommitted)** | `personalizeAiAssist.js` (397): `runAiAssistEdit` `:166`, `resolveAssetForRole` `:85`, `AI_ASSIST_ROLES` `:50` (all 6 spec roles), role validation, 32000-char instruction cap, progress phases, error codes; routes image edits to `openaiService.editImageResponses` (`:257`) and video intent (face_identity) to `generationRouter.runGeneration` MuAPI face-swap/recast (`:224`). Tests: `__tests__/personalizeAiAssist.test.js` (324) |
| 5 | **Upload + media persistence** (MuAPI + Supabase, temp vs permanent) | **PARTIAL** | `sharedMediaStore.js` (157, localStorage history, `addEntry`), SQL migration `20261012000000_create_personalization_outputs.sql` (87). **NOT implemented:** server record API route (OpenHiggsBolt `app/api/personalization/record/route.ts`), `supabaseSharedMedia` mirror helper, upload of assets to Supabase storage, migration of transient MuAPI URLs to permanent records |
| 6 | **Dependencies** | **PARTIAL** | Zero new npm packages. Deviations from source stack: zustand NOT used (repo `Store` base class instead, `assetLibraryStore.js:20`), cheerio/crawlee NOT required (dynamic-import with regex fallback), dnd-kit NOT used (no drag-drop UI ported). Reuses existing `src/lib/muapi.js`, `src/lib/openaiService.js`, `react` |
| 7 | **Tests** | **IMPLEMENTED** | 12 committed test files (1,759 LOC, **166 tests — all passing**; discovery alone: 6 files, 96 tests) + 2 WIP test files (545 LOC, 42 tests) + 1 debug file to delete. Full numbers in `FINAL_VERIFICATION_PLAN.md` §3 |
| 8 | **Auth architecture** | **PARTIAL — open issue** | Migration rewrites RLS from Clerk `set_config('app.clerk_user_id')` to Supabase `auth.uid()` via `public.current_user_id()` (`20261012000000_create_personalization_outputs.sql:68-74`, policies `:81-87`). **Inconsistency to resolve before merge:** the migration header (`:15`) states "remix-new-editor uses Supabase Auth (not Clerk)", but `FEATURE_COMPLETION_MATRIX.md` records Clerk as the app's identity provider (`src/lib/clerkInit.js`, `<ClerkProvider>` in `ClerkAuth.jsx:38`/`HeaderAuth.jsx:67`). If Clerk stays the IdP, `auth.uid()` returns null and the table locks to zero rows — the policies must be re-derived from the Clerk→Supabase JWT path before deploy |

## 3. Verified Provider Contracts (summarized from PERSONALIZATION_SOURCE_AUDIT.md §5)

**MuAPI file upload** (`https://muapi.ai/docs/file-upload`): `POST https://api.muapi.ai/api/v1/upload_file`, auth header `x-api-key: <KEY>` (no Bearer), `multipart/form-data`, single `file` part. Limits: images 10 MB (jpg/png/webp), videos 50 MB (mp4/mov), other 10 MB (zip/pdf/json). Response `{ "url": "https://s3.amazonaws.com/muapi-assets/outputs/..." }` — **TEMPORARY presigned URL, expires ~1 hour**. Free, requires credit balance > 0.

**OpenAI Responses API**: `POST https://api.openai.com/v1/responses`; tool `image_generation` with `{ model, action: "auto"|"generate"|"edit", partial_images?: 0-3 }`; image inputs `type: "input_image"` with `file_id` or `image_url` (data: base64 OK); SSE events `response.image_generation_call.partial_image`, `response.completed`.

**OpenAI image edits** (`/v1/images/edits`): default model `gpt-image-2.5-sunburst` (also `gpt-image-2.5-flare`, `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1`); up to 16 input images; `images: [{file_id|image_url}]`, `prompt`, `mask?`; streaming events `image_edit.partial_image`, `image_edit.completed`.

Model IDs actually used by the port (`src/components/personalize/modelCapabilityResolver.js:39-42`): `FACE_SWAP_MODEL='ai-video-face-swap'`, `FULL_BODY_MODEL='kling-v3.0-pro-recast'`, `DEFAULT_T2V_MODEL='veo-4-text-to-video'`, `DEFAULT_I2I_MODEL='gpt-image-2-edit'`; `personalizeAiAssist.js:73` uses `OPENAI_IMAGE_EDIT_MODEL='gpt-image-2.5-sunburst'` for precise editing. The SA-2 drift register (`docs/personalization-verify-muapi-drift.md`, source-side) flags `gpt-image-2-edit` as renamed/aliased on branch `fix/personalization-i2i-model-and-test-alias` (`38e15f94`) — **re-verify against `muapi.ai/api/v1/models` before any live call**. No live provider calls were made in this integration (all mocked).

## 4. Deviations from Source

| # | Source (OpenHiggsBolt) | Integration | Evidence |
|---|---|---|---|
| 1 | zustand `persist` middleware | repo `Store` base class | `assetLibraryStore.js:20` `import Store from '../../stores/base/Store.js'`; `class AssetLibraryStore extends Store` (`:93`) |
| 2 | localStorage keys `smartvideo_clients`, `smartvideo_current_client_id`, `smartvideo_shared_media` | `remix_personalization_clients_v1`, `remix_personalization_current_client_v1`, `remix_personalization_shared_media_v1`, `remix_personalization_assets_v1` | `clientProfileStore.js:19-31`, `assetLibraryStore.js:23`, `sharedMediaStore.js:22` |
| 3 | React Context provider (`DemoPersonalizeProvider.tsx`) | `useSyncExternalStore` hooks | `assetLibraryStore.js:21` `import { useSyncExternalStore } from 'react'`; hooks `:297-305` |
| 4 | RLS via Clerk `supabase.rpc('set_config', {setting:'app.clerk_user_id'})` | RLS via Supabase `auth.uid()` + `public.current_user_id()` | migration `:6-31`, `:68-74` — **see §2 area 8 open issue** |
| 5 | MuAPI granular function imports (`@/packages/studio/src/muapi`) | class singleton `muapi` from `src/lib/muapi.js`; `processRecast` shimmed onto `processV2V` | `generationRouter.js:9-26`, `:31`, `:47-54` |
| 6 | Caller-supplied `apiKey` argument | preserved in signature, resolved by canonical client via `apiKeyManager.getMuapiKey()`; argument unused | `generationRouter.js:23-25` |
| 7 | TypeScript `.ts`/`.tsx` | plain `.js` with JSDoc typedefs | `types.js:4-13` |
| 8 | `PersonalizationModal.tsx` (1745 LOC monolith) | NOT ported (UI out of scope for this phase) | §6 |

## 5. Security Decisions

1. **No browser-side API keys.** The source leaks this (SA-2 risk 5: MuAPI `x-api-key` sent from the browser XHR, `muapi.js:317`). The port never reads or forwards a provider key: `generationRouter.js` passes the caller `apiKey` through unused (`:23-25`) and the canonical client resolves keys via `apiKeyManager`; `personalizeAiAssist.js:34-35` documents the hard rule and the availability check uses `openaiService._hasKey()` (`:373`).
2. **MuAPI upload URLs treated as transient.** `personalizeAiAssist.js:36-37` and `:309-313`: outputs are persisted as `sharedMediaStore` entries; the provider URL is never stored as the durable handle.
3. **http(s)-only asset URLs.** Asset URLs are validated with `/^https?:\/\//` before use — `personalizeAiAssist.js:138` (mask derivation) and `:200` (asset URL); `studioBridge.js:106` (reference collection). Data URLs are explicitly rejected with `ASSET_URL_UNSUPPORTED` (`personalizeAiAssist.js:200-206`).
4. **No `eval`/`Function` on model output.** Verified: `grep -rn "eval(\|new Function" src/components/personalize/` returns 0 matches (source + tests).
5. **Error hygiene.** `describe()` truncates provider errors to 300 chars so keys/URLs-with-tokens never reach the UI (`personalizeAiAssist.js:358-363`).
6. **Discovery SSRF guards** (greenfield): private-IP blocking (`urlSafety.js:171`), DNS-rebinding re-resolution per hop (`:304`, applied in `staticFetch.js` redirect loop), social-domain blocklist (`:85`), junk-extension + 2048-char URL-length caps (`:39`, `:98`), 50-URL sitemap cap, 3-concurrent-job limit, 60s/URL timeout.
7. **RLS enabled** on `personalization_outputs` (migration `:76`) with select+insert policies scoped to the calling user (`:81-87`).

## 6. Studio Integration Approach — ISOLATED COMPATIBILITY LAYER

`src/components/personalize/studioBridge.js` (253 LOC, WIP uncommitted) is an **isolated compatibility layer**. The integration does **not** edit `src/components/RenderPage.js` or `src/lib/cinegen.js` — verified unmodified (`git status --short` on both paths returns empty). It projects personalization assets into the exact shapes the studios already consume; every function returns a neutral frozen value when personalization has no data (`studioBridge.js:45-50`), so studio behavior is unchanged when the library is empty. Studio values win on conflict (`:227-228`, studio-first precedence).

> **Separate uncommitted change, NOT part of this integration:** `src/components/TimelineEditorPage.jsx` carries a +3/−1 working-tree edit (adds `zoom`/`hand` tools; replaces `state.selectedTool = toolMap[toolKey]` with `selectTool(toolMap[toolKey])`). Neither personalization commit touches that file. It violates the master-mission no-Timeline-Editor-edits directive and causes 1 full-suite failure (`src/lib/editor/__tests__/timeline-editor-mask.test.js`). It must be committed, reverted, or explicitly approved before merge — see `RELEASE_READINESS.md` §5 risk 4 and `FINAL_VERIFICATION_PLAN.md` §2 item 10.

Exact one-line integration points (documented in `studioBridge.js:21-34`, **not yet applied**):

- **Render Studio** — at the point where `src/components/RenderPage.js` already uploads a reference image:
  ```js
  const p = resolveForRenderStudio();  // then merge p.referenceImages / p.promptPrefix / p.lastFrameUrl into the existing payload
  ```
- **CineGen** — inside `src/lib/cinegen.js` `generateElement(params)` / `generateVideo(params)`:
  ```js
  const p = resolveForCineGen(params);   // merge p.image_url / p.images_list / p.promptSuffix into the existing muapi.* call
  ```
  or, for call sites that want the merge done for them:
  ```js
  return callCineGenWithPersonalization(cinegen, 'generateElement', params);  // studioBridge.js:221
  ```

Exports: `resolveForRenderStudio` (`:122`), `resolveForCineGen` (`:156`), `callCineGenWithPersonalization` (`:221`), `useStudioBridge` (`:240`), `hasPersonalizationData` (`:249`). CineGen mapping reuses the keys `muapi` already accepts: `image_url`, `images_list`, `prompt`, `aspect_ratio` (`:150-154`).

## 7. What Is NOT Done

1. **`PersonalizationModal.tsx` UI port** — the 1745-LOC source modal (Who-Is-This-For selector, Client Profile form, `UploadZone` sections, drag-drop, primary/remove controls, output panel) is NOT ported. No UI exists for the new stores; the asset-grid UI, mode selector, and output panel remain to be built (SA-2 port manifest recommends splitting into `ClientProfileForm`, `AssetGrid`, `PromptEditor`, `ModeSelector`, `OutputPanel`).
2. **Discovery → asset-library wiring** — no module under `src/components/personalize/*.js` imports `discovery/index.js` (verified by grep); discovery job results (`found: { urls, logos, products, brandReferences }`, `discovery/index.js:80-84`) are never written into `assetLibraryStore`, no UI triggers `discoverAssets`.
3. **Persistence API** — the `/api/personalization/record` route, `supabaseSharedMedia` mirror helper, and asset upload-to-storage path are not implemented; `sharedMediaStore` remains localStorage-only. The SQL migration exists but has never been applied to a live database.
4. **Studio wiring** — §6 integration points are documented but not applied; `RenderPage.js` and `src/lib/cinegen.js` are untouched.
5. **Cross-studio handoff** — existing `src/lib/personalizerHandoff.js` / `personalizerAdapters.js` (on main) are NOT wired to the new stores; `generationRouter.js` exports `buildImageStudioHandoff`/`buildVideoStudioHandoff` but no studio calls them.
6. **MuAPI model-ID drift re-verification** (SA-2 risk 1) and the Clerk-vs-Supabase-Auth RLS decision (§2 area 8) remain open.
